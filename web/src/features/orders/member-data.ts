import type { PrismaClient } from "../../generated/prisma/client";
import type { RequestContext, OrderView, SeasonView, StyleView, ArtworkSetView } from "../../domain/types";
import type { CompositeSpec } from "../artwork/composite";
export type ShopData = { season: SeasonView | null; styles: StyleView[]; artworkSets: ArtworkSetView[]; open: boolean; preview: boolean; status: string; confirmationEmailsEnabled: boolean };
export type MemberOrder = OrderView & { season: SeasonView; canEdit: boolean; catalog: ShopData; previews: Record<string, { front: CompositeSpec; back: CompositeSpec }> };
import { db, withTransaction, type DbTransaction } from "../../server/db";
import { AppError } from "../../domain/errors";
import { idSchema } from "../../domain/schemas";
import { isOrderingOpen, seasonStatus } from "../seasons/clock";
import { resolvePlacement } from "../artwork/composite";
import { backPhotoColorIds } from "../artwork/photo-sides";
import { confirmationEmailsEnabled } from "../../server/order-email";
async function catalog(tx: DbTransaction, season: SeasonView, now: Date, preview = false): Promise<ShopData> {
 const styles = await tx.merchandiseStyle.findMany({ where: { seasonId: season.id }, orderBy: [{ position: "asc" }, { id: "asc" }], include: { colors: { orderBy: { position: "asc" } }, sizes: { orderBy: { position: "asc" } }, artworkSets: { orderBy: { position: "asc" } }, blankPhotos: { select: { side: true, colorId: true } } } });
 const sets = await tx.artworkSet.findMany({ where: { seasonId: season.id }, orderBy: [{ position: "asc" }, { id: "asc" }] });
 return { season, styles: styles.map(s => ({ id: s.id, seasonId: s.seasonId, name: s.name, description: s.description, manufacturerUrl: s.manufacturerUrl, unitPriceCents: s.unitPriceCents, cut: s.cut, version: s.version, colors: s.colors.map(c => ({ id: c.id, name: c.name, hex: c.hex, position: c.position })), sizes: s.sizes.map(z => ({ id: z.id, label: z.label, position: z.position })), backPhotoColorIds: backPhotoColorIds(s.colors,s.blankPhotos), artworkSetIds: s.artworkSets.map(a => a.artworkSetId) })), artworkSets: sets.map(s => ({ id: s.id, seasonId: s.seasonId, name: s.name, frontAssetId: s.frontAssetId, backAssetId: s.backAssetId, version: s.version })), open: !preview && isOrderingOpen(season, now), preview, status: seasonStatus(season, now), confirmationEmailsEnabled: confirmationEmailsEnabled() };
}
export function createMemberData(client: PrismaClient = db) { return {
 async shop(ctx: RequestContext, previewId?: string): Promise<ShopData> {
  if (previewId !== undefined && ctx.actor.role !== "admin") throw new AppError("FORBIDDEN", 403, "Administrator preview only.");
  if (previewId !== undefined && !idSchema.safeParse(previewId).success) throw new AppError("NOT_FOUND", 404, "Season not found.");
  return withTransaction(async tx => {
   const seasons = await tx.season.findMany({ where: previewId ? { id: previewId } : { lifecycle: "PUBLISHED" }, orderBy: [{ opensOn: "desc" }, { id: "asc" }] });
   const season = seasons.find(s => isOrderingOpen(s, ctx.now)) ?? seasons[0];
   if (previewId && !season) throw new AppError("NOT_FOUND", 404, "Season not found.");
   return season ? catalog(tx, season, ctx.now, previewId !== undefined) : { season: null, styles: [], artworkSets: [], open: false, preview: false, status: "", confirmationEmailsEnabled: confirmationEmailsEnabled() };
  }, client);
 },
 // Called only after the order service has authorized lookup/mutation. No public ID resolver.
 async present(ctx: RequestContext, order: OrderView): Promise<MemberOrder> {
  return withTransaction(async tx => {
   const season = await tx.season.findUniqueOrThrow({ where: { id: order.seasonId } });
   const previews: MemberOrder["previews"] = {};
   for (const line of order.lines) {
    const style = await tx.merchandiseStyle.findUniqueOrThrow({ where: { id: line.styleId } });
    const set = await tx.artworkSet.findUniqueOrThrow({ where: { id: line.artworkSetId } });
    const pair = {} as { front: CompositeSpec; back: CompositeSpec };
    for (const side of ["front", "back"] as const) {
     const where = { styleId: line.styleId, side, scopeKey: { in: ["all", line.colorId] } };
     const photos = await tx.blankPhoto.findMany({ where });
     const placements = await tx.placement.findMany({ where: { ...where, artworkSetId: line.artworkSetId } });
     const blank = photos.find(p => p.colorId === line.colorId) ?? photos.find(p => p.colorId === null);
     const asset = side === "front" ? set.frontAssetId : set.backAssetId;
     pair[side] = { blankUrl: blank ? `/api/assets/${blank.assetId}` : null, artworkUrl: asset ? `/api/assets/${asset}` : null, cut: style.cut, color: line.colorHex, side, placement: resolvePlacement(placements.find(p => p.colorId === null) ?? null, placements.find(p => p.colorId === line.colorId) ?? null) };
    }
    previews[line.id] = pair;
   }
   return { ...order, season, canEdit: isOrderingOpen(season, ctx.now) && order.progress === "OPEN", catalog: await catalog(tx, season, ctx.now), previews };
  }, client);
 }
}; }
