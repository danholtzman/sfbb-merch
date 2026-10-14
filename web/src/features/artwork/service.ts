import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import type { RequestContext, Side, PlacementValues, ArtworkSetView } from "../../domain/types";
import { db, withTransaction, assertVersionWrite, type DbTransaction } from "../../server/db";
import { AppError } from "../../domain/errors";
import { idSchema, sideSchema, versionSchema, placementSchema, normalizedName } from "../../domain/schemas";
import { parseCatalog } from "../catalog/colors";
import { validateSeasonReadiness } from "../seasons/service";
import { resolvePlacement, type CompositeSpec } from "./composite";
import { assetUrl } from "./assets";
function admin(ctx: RequestContext) { if (ctx.actor.role !== "admin") throw new AppError("FORBIDDEN", 403, "Administrator access is required."); }
async function setRecord(tx: DbTransaction, id: string, version: number) {
 parseCatalog(idSchema, id); parseCatalog(versionSchema, version);
 const set = await tx.artworkSet.findUnique({ where: { id } }); if (!set) throw new AppError("NOT_FOUND", 404, "Artwork set not found.");
 assertVersionWrite(set.version === version ? 1 : 0); return set;
}
async function styleColor(tx: DbTransaction, styleId: string, colorId: string | null) {
 parseCatalog(idSchema, styleId); if (colorId) parseCatalog(idSchema, colorId);
 const style = await tx.merchandiseStyle.findUnique({ where: { id: styleId } }); if (!style) throw new AppError("NOT_FOUND", 404, "Shirt style not found.");
 if (colorId && !await tx.styleColor.findFirst({ where: { id: colorId, styleId } })) throw new AppError("INVALID_COLOR", 422, "The color does not belong to this style."); return style;
}
async function seasonChanged(tx: DbTransaction, seasonId: string) { await tx.season.update({ where: { id: seasonId }, data: { version: { increment: 1 } } }); }
async function validatePublished(tx: DbTransaction, seasonId: string) { if ((await tx.season.findUniqueOrThrow({ where: { id: seasonId } })).lifecycle === "PUBLISHED") await validateSeasonReadiness(tx, seasonId); }
export function createArtworkService(client: PrismaClient = db) { return {
 async createArtworkSet(ctx: RequestContext, seasonId: string, raw: string): Promise<ArtworkSetView> {
  admin(ctx); parseCatalog(idSchema, seasonId); const name = parseCatalog(z.string().trim().min(1).max(60), raw);
  return withTransaction(async tx => {
   if (!await tx.season.findUnique({ where: { id: seasonId } })) throw new AppError("NOT_FOUND", 404, "Season not found.");
   if (await tx.artworkSet.findFirst({ where: { seasonId, normalizedName: normalizedName(name) } })) throw new AppError("INVALID_INPUT", 422, "Artwork set names must be unique, ignoring case and spaces.");
   const last = await tx.artworkSet.aggregate({ where: { seasonId }, _max: { position: true } });
   const set = await tx.artworkSet.create({ data: { seasonId, name, normalizedName: normalizedName(name), position: (last._max.position ?? -1) + 1 } });
   await seasonChanged(tx, seasonId); return set;
  }, client);
 },
 async replaceArtworkSide(ctx: RequestContext, id: string, version: number, side: Side, assetId: string): Promise<ArtworkSetView> {
  admin(ctx); parseCatalog(sideSchema, side); parseCatalog(idSchema, assetId);
  return withTransaction(async tx => {
   const set = await setRecord(tx, id, version), asset = await tx.asset.findUnique({ where: { id: assetId } });
   if (!asset || asset.mime !== "image/png") throw new AppError("INVALID_IMAGE", 422, "Choose a stored PNG artwork image.");
   assertVersionWrite((await tx.artworkSet.updateMany({ where: { id, version }, data: { [side === "front" ? "frontAssetId" : "backAssetId"]: assetId, version: { increment: 1 } } })).count);
   await validatePublished(tx, set.seasonId); await seasonChanged(tx, set.seasonId);
   return tx.artworkSet.findUniqueOrThrow({ where: { id } });
  }, client);
 },
 async setBlankPhoto(ctx: RequestContext, styleId: string, colorId: string | null, side: Side, assetId: string, expectedVersion?: number): Promise<void> {
  admin(ctx); parseCatalog(sideSchema, side); parseCatalog(idSchema, assetId);
  return withTransaction(async tx => {
   const style = await styleColor(tx, styleId, colorId);
   if (expectedVersion !== undefined) { parseCatalog(versionSchema, expectedVersion); assertVersionWrite(style.version === expectedVersion ? 1 : 0); }
   if (!await tx.asset.findUnique({ where: { id: assetId } })) throw new AppError("INVALID_IMAGE", 422, "Choose a stored blank-shirt image.");
   const scopeKey = colorId ?? "all";
   await tx.blankPhoto.upsert({ where: { styleId_side_scopeKey: { styleId, side, scopeKey } }, create: { styleId, colorId, side, scopeKey, assetId }, update: { assetId, version: { increment: 1 } } });
   await tx.merchandiseStyle.update({ where: { id: styleId }, data: { version: { increment: 1 } } }); await seasonChanged(tx, style.seasonId);
  }, client);
 },
 async savePlacement(ctx: RequestContext, styleId: string, setId: string, side: Side, colorId: string | null, values: PlacementValues): Promise<void> {
  admin(ctx); parseCatalog(sideSchema, side); parseCatalog(idSchema, setId); const input = parseCatalog(placementSchema, values);
  return withTransaction(async tx => {
   const style = await styleColor(tx, styleId, colorId);
   if (!await tx.styleArtworkSet.findFirst({ where: { styleId, artworkSetId: setId, artworkSet: { seasonId: style.seasonId } } })) throw new AppError("INVALID_SET", 422, "The artwork set is not available for this style.");
   const scopeKey = colorId ?? "all";
   await tx.placement.upsert({ where: { styleId_artworkSetId_side_scopeKey: { styleId, artworkSetId: setId, side, scopeKey } }, create: { styleId, artworkSetId: setId, side, colorId, scopeKey, ...input }, update: { ...input, version: { increment: 1 } } });
  }, client);
 },
 async getCompositeSpec(styleId: string, setId: string, colorId: string, side: Side): Promise<CompositeSpec> {
  parseCatalog(sideSchema, side); parseCatalog(idSchema, setId); parseCatalog(idSchema, colorId);
  return withTransaction(async tx => {
   const style = await styleColor(tx, styleId, colorId), color = await tx.styleColor.findUniqueOrThrow({ where: { id: colorId } });
   const association = await tx.styleArtworkSet.findFirst({ where: { styleId, artworkSetId: setId, artworkSet: { seasonId: style.seasonId } }, include: { artworkSet: true } });
   if (!association) throw new AppError("INVALID_SET", 422, "The artwork set is not available for this style.");
   const photos = await tx.blankPhoto.findMany({ where: { styleId, side, scopeKey: { in: ["all", colorId] } } });
   const blank = photos.find(p => p.colorId === colorId) ?? photos.find(p => p.colorId === null);
   const placements = await tx.placement.findMany({ where: { styleId, artworkSetId: setId, side, scopeKey: { in: ["all", colorId] } } });
   const artworkId = side === "front" ? association.artworkSet.frontAssetId : association.artworkSet.backAssetId;
   return { blankUrl: blank ? assetUrl(blank.assetId) : null, artworkUrl: artworkId ? assetUrl(artworkId) : null, cut: style.cut, color: color.hex, side, placement: resolvePlacement(placements.find(p => p.colorId === null) ?? null, placements.find(p => p.colorId === colorId) ?? null) };
  }, client);
 },
 async deleteArtworkSet(ctx: RequestContext, id: string, version: number, expectedReplacementSetId?: string): Promise<{ replacementSetId: string }> {
  admin(ctx); return withTransaction(async tx => {
   const set = await setRecord(tx, id, version);
   const remaining = await tx.artworkSet.findMany({ where: { seasonId: set.seasonId, id: { not: id } }, orderBy: [{ position: "asc" }, { id: "asc" }] });
   if (!remaining.length) throw new AppError("LAST_ARTWORK_SET", 409, "Keep at least one artwork set in the season.");
   if (expectedReplacementSetId !== undefined && remaining[0].id !== parseCatalog(idSchema, expectedReplacementSetId)) throw new AppError("STALE_VERSION", 409, "The replacement artwork set changed. Reload before deleting.");
   if (await tx.orderLine.count({ where: { artworkSetId: id } })) throw new AppError("ARTWORK_IN_USE", 409, "This artwork set is used by an order, including any cancelled order, and cannot be deleted.");
   const affected = await tx.styleArtworkSet.findMany({ where: { artworkSetId: id } });
   for (const association of affected) {
    if (await tx.styleArtworkSet.count({ where: { styleId: association.styleId } }) === 1) await tx.styleArtworkSet.create({ data: { styleId: association.styleId, artworkSetId: remaining[0].id, position: 0 } });
    await tx.merchandiseStyle.update({ where: { id: association.styleId }, data: { version: { increment: 1 } } });
   }
   assertVersionWrite((await tx.artworkSet.deleteMany({ where: { id, version } })).count);
   await validatePublished(tx, set.seasonId); await seasonChanged(tx, set.seasonId);
   return { replacementSetId: remaining[0].id };
  }, client);
 },
 }; }
export const replaceArtworkSide = (ctx: RequestContext, id: string, version: number, side: Side, asset: string) => createArtworkService().replaceArtworkSide(ctx, id, version, side, asset);
export const setBlankPhoto = (ctx: RequestContext, style: string, color: string | null, side: Side, asset: string) => createArtworkService().setBlankPhoto(ctx, style, color, side, asset);
export const savePlacement = (ctx: RequestContext, style: string, set: string, side: Side, color: string | null, values: PlacementValues) => createArtworkService().savePlacement(ctx, style, set, side, color, values);
export const getCompositeSpec = (style: string, set: string, color: string, side: Side) => createArtworkService().getCompositeSpec(style, set, color, side);
export const deleteArtworkSet = (ctx: RequestContext, id: string, version: number) => createArtworkService().deleteArtworkSet(ctx, id, version);
