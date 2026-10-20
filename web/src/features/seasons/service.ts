import type { PrismaClient } from "../../generated/prisma/client";
import type { RequestContext, SeasonView } from "../../domain/types";
import { AppError } from "../../domain/errors";
import { db, withTransaction, assertVersionWrite, type DbTransaction } from "../../server/db";
import { idSchema, versionSchema } from "../../domain/schemas";
import { createSchema, settingsSchema, parse, validateDates, type CreateSeasonInput, type SeasonSettingsInput } from "./validation";
import { preferredSeason, seasonStatus } from "./clock";
export { isOrderingOpen, seasonStatus } from "./clock";
export type SeasonSummary = SeasonView & { status: string; styleCount: number; activeOrderCount: number };
function admin(ctx: RequestContext) { if (ctx.actor.role !== "admin") throw new AppError("FORBIDDEN", 403, "Administrator access is required."); }
async function current(tx: DbTransaction, id: string, expectedVersion: number) {
  parse(idSchema, id); parse(versionSchema, expectedVersion);
  const season = await tx.season.findUnique({ where: { id } });
  if (!season) throw new AppError("NOT_FOUND", 404, "Season not found.");
  assertVersionWrite(season.version === expectedVersion ? 1 : 0);
  return season;
}
async function noOverlap(tx: DbTransaction, season: SeasonView) {
  const conflict = await tx.season.findFirst({ where: { id: { not: season.id }, lifecycle: "PUBLISHED", opensOn: { lte: season.closesOn }, closesOn: { gte: season.opensOn } } });
  if (conflict) throw new AppError("SEASON_OVERLAP", 422, `These dates overlap the published season “${conflict.name}”. Opening and closing dates are inclusive.`, { opensOn: "Published ordering windows cannot share a day." });
}
export async function validateSeasonReadiness(tx: DbTransaction, id: string) {
  const styles = await tx.merchandiseStyle.findMany({ where: { seasonId: id }, include: { colors: true, sizes: true, artworkSets: { include: { artworkSet: { include: { frontAsset: true, backAsset: true } } } } } });
  const fields: Record<string, string> = {};
  if (!styles.length) fields.styles = "Add at least one shirt style.";
  for (const style of styles) {
    if (!style.colors.length || !style.sizes.length) fields[style.id] = `${style.name}: add at least one color and size.`;
    if (!style.artworkSets.length) fields[`${style.id}.artwork`] = `${style.name}: assign an artwork set.`;
    for (const { artworkSet: set } of style.artworkSets) {
      if (set.seasonId !== id) fields[`${set.id}.season`] = `${set.name}: artwork must belong to this season.`;
      for (const side of ["front", "back"] as const) {
        const asset = side === "front" ? set.frontAsset : set.backAsset;
        if (side === "back" && !asset) continue;
        if (!asset || asset.mime !== "image/png" || asset.width <= 0 || asset.height <= 0 || asset.byteSize <= 0) fields[`${set.id}.${side}`] = `${set.name}: upload a valid ${side} PNG.`;
      }
    }
  }
  if (Object.keys(fields).length) throw new AppError("SEASON_NOT_READY", 422, "This season is not ready to publish.", fields);
}
export function createSeasonService(client: PrismaClient = db) {
  return {
    async listSeasons(ctx: RequestContext): Promise<SeasonSummary[]> {
      admin(ctx);
      const seasons = await client.season.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { _count: { select: { styles: true, orders: { where: { cancelled: false } } } } } });
      return seasons.map(s => ({ id: s.id, name: s.name, opensOn: s.opensOn, closesOn: s.closesOn, announcement: s.announcement, lifecycle: s.lifecycle, version: s.version, status: seasonStatus(s, ctx.now), styleCount: s._count.styles, activeOrderCount: s._count.orders }));
    },
    async createSeason(ctx: RequestContext, raw: unknown): Promise<SeasonView> {
      admin(ctx); const input = parse(createSchema, raw); validateDates(input);
      if (input.reuseArtwork && !input.copyFromSeasonId) throw new AppError("INVALID_INPUT", 422, "Choose a season to copy first.");
      return withTransaction(async tx => {
        const source = input.copyFromSeasonId ? await tx.season.findUnique({ where: { id: input.copyFromSeasonId }, include: { artworkSets: { orderBy: { position: "asc" } }, styles: { orderBy: { position: "asc" }, include: { colors: true, sizes: true, blankPhotos: true, artworkSets: true, placements: true } } } }) : null;
        if (input.copyFromSeasonId && !source) throw new AppError("NOT_FOUND", 404, "The source season no longer exists.");
        const { name, opensOn, closesOn, announcement } = input;
        const season = await tx.season.create({ data: { name, opensOn, closesOn, announcement } });
        const sets = new Map<string, string>();
        let freshId = "";
        if (input.reuseArtwork && source?.artworkSets.length) {
          for (const set of source.artworkSets) {
            const copied = await tx.artworkSet.create({ data: { seasonId: season.id, name: set.name, normalizedName: set.normalizedName, position: set.position, frontAssetId: set.frontAssetId, backAssetId: set.backAssetId } });
            sets.set(set.id, copied.id);
          }
        } else {
          freshId = (await tx.artworkSet.create({ data: { seasonId: season.id, name: "Season artwork", normalizedName: "season artwork" } })).id;
        }
        for (const style of source?.styles ?? []) {
          const copy = await tx.merchandiseStyle.create({ data: { seasonId: season.id, name: style.name, description: style.description, manufacturerUrl: style.manufacturerUrl, unitPriceCents: style.unitPriceCents, cut: style.cut, position: style.position } });
          const colors = new Map<string, string>();
          for (const color of style.colors) {
            const newColor = await tx.styleColor.create({ data: { styleId: copy.id, name: color.name, normalizedName: color.normalizedName, hex: color.hex, position: color.position } }); colors.set(color.id, newColor.id);
          }
          for (const size of style.sizes) await tx.styleSize.create({ data: { styleId: copy.id, label: size.label, normalizedLabel: size.normalizedLabel, position: size.position } });
          for (const photo of style.blankPhotos) {
            const colorId = photo.colorId ? colors.get(photo.colorId) : null;
            if (photo.colorId && !colorId) throw new AppError("INVALID_CATALOG", 422, "The source has a blank photo with an invalid color.");
            await tx.blankPhoto.create({ data: { styleId: copy.id, colorId, scopeKey: colorId ?? "all", side: photo.side, assetId: photo.assetId } });
          }
          if (freshId) await tx.styleArtworkSet.create({ data: { styleId: copy.id, artworkSetId: freshId, position: 0 } });
          else {
            for (const association of style.artworkSets) {
              const artworkSetId = sets.get(association.artworkSetId);
              if (!artworkSetId) throw new AppError("INVALID_CATALOG", 422, "The source style references artwork from another season.");
              await tx.styleArtworkSet.create({ data: { styleId: copy.id, artworkSetId, position: association.position } });
            }
            for (const placement of style.placements) {
              const artworkSetId = sets.get(placement.artworkSetId), colorId = placement.colorId ? colors.get(placement.colorId) : null;
              if (!artworkSetId || (placement.colorId && !colorId)) throw new AppError("INVALID_CATALOG", 422, "The source has an invalid placement reference.");
              await tx.placement.create({ data: { styleId: copy.id, artworkSetId, colorId, scopeKey: colorId ?? "all", side: placement.side, x: placement.x, y: placement.y, width: placement.width, rotation: placement.rotation } });
            }
          }
        }
        return season;
      }, client);
    },
    async updateSeason(ctx: RequestContext, id: string, expectedVersion: number, raw: unknown): Promise<SeasonView> {
      admin(ctx); const input = parse(settingsSchema, raw); validateDates(input);
      return withTransaction(async tx => {
        const season = await current(tx, id, expectedVersion);
        if (season.lifecycle === "PUBLISHED") await noOverlap(tx, { ...season, ...input });
        const result = await tx.season.updateMany({ where: { id, version: expectedVersion }, data: { ...input, version: { increment: 1 } } }); assertVersionWrite(result.count);
        return tx.season.findUniqueOrThrow({ where: { id } });
      }, client);
    },
    async publishSeason(ctx: RequestContext, id: string, expectedVersion: number): Promise<SeasonView> {
      admin(ctx); return withTransaction(async tx => {
        const season = await current(tx, id, expectedVersion);
        if (season.lifecycle !== "DRAFT") throw new AppError("INVALID_LIFECYCLE", 422, "Only a draft season can be published.");
        await noOverlap(tx, season); await validateSeasonReadiness(tx, id);
        const result = await tx.season.updateMany({ where: { id, version: expectedVersion }, data: { lifecycle: "PUBLISHED", version: { increment: 1 } } }); assertVersionWrite(result.count);
        return tx.season.findUniqueOrThrow({ where: { id } });
      }, client);
    },
    async deleteSeason(ctx: RequestContext, id: string, expectedVersion: number): Promise<{ selectedSeasonId: string }> {
      admin(ctx); return withTransaction(async tx => {
        await current(tx, id, expectedVersion);
        if (await tx.order.count({ where: { seasonId: id } })) throw new AppError("SEASON_HAS_ORDERS", 409, "This season has orders, including any cancelled orders, and cannot be deleted.");
        if (await tx.season.count() <= 1) throw new AppError("LAST_SEASON", 409, "Keep at least one season. The last season cannot be deleted.");
        const result = await tx.season.deleteMany({ where: { id, version: expectedVersion } }); assertVersionWrite(result.count);
        const remaining = await tx.season.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        // Asset files are shared across copies. Unreferenced-file cleanup belongs to the asset service.
        return { selectedSeasonId: preferredSeason(remaining, ctx.now)!.id };
      }, client);
    },
  };
}
export const createSeason = (ctx: RequestContext, input: CreateSeasonInput) => createSeasonService().createSeason(ctx, input);
export const updateSeason = (ctx: RequestContext, id: string, version: number, input: SeasonSettingsInput) => createSeasonService().updateSeason(ctx, id, version, input);
export const publishSeason = (ctx: RequestContext, id: string, version: number) => createSeasonService().publishSeason(ctx, id, version);
export const deleteSeason = (ctx: RequestContext, id: string, version: number) => createSeasonService().deleteSeason(ctx, id, version);
