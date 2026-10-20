import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import type { RequestContext, StyleView, ArtworkSetView } from "../../domain/types";
import { db, withTransaction, assertVersionWrite, type DbTransaction } from "../../server/db";
import { AppError } from "../../domain/errors";
import { centsSchema, idSchema, versionSchema, normalizedName } from "../../domain/schemas";
import { validateSeasonReadiness } from "../seasons/service";
import { colorsSchema, createStyleSchema, styleDetailsSchema, parseCatalog, uniqueSizes, validateColorNames, type ColorInput, type CreateStyleInput } from "./colors";
const include = { colors: { orderBy: { position: "asc" } }, sizes: { orderBy: { position: "asc" } }, artworkSets: { orderBy: { position: "asc" } }, orderLines: { select: { colorId: true } } } as const;
type LoadedStyle = Prisma.MerchandiseStyleGetPayload<{ include: typeof include }>;
export type CatalogStyle = StyleView & { orderedColorIds: string[]; removedColorIds?: string[]; removedSetIds?: string[] };
export type CatalogSnapshot = { styles: CatalogStyle[]; artworkSets: ArtworkSetView[] };
function view(style: LoadedStyle): CatalogStyle {
 return { id: style.id, seasonId: style.seasonId, name: style.name, description: style.description, manufacturerUrl: style.manufacturerUrl, unitPriceCents: style.unitPriceCents, cut: style.cut, version: style.version, colors: style.colors.map(c => ({ id: c.id, name: c.name, hex: c.hex, position: c.position })), sizes: style.sizes.map(s => ({ id: s.id, label: s.label, position: s.position })), artworkSetIds: style.artworkSets.map(s => s.artworkSetId), orderedColorIds: [...new Set(style.orderLines.map(l => l.colorId))] };
}
function admin(ctx: RequestContext) { if (ctx.actor.role !== "admin") throw new AppError("FORBIDDEN", 403, "Administrator access is required."); }
async function season(tx: DbTransaction, id: string) {
 parseCatalog(idSchema, id); const record = await tx.season.findUnique({ where: { id } });
 if (!record) throw new AppError("NOT_FOUND", 404, "Season not found."); return record;
}
async function current(tx: DbTransaction, id: string, version: number) {
 parseCatalog(idSchema, id); parseCatalog(versionSchema, version);
 const style = await tx.merchandiseStyle.findUnique({ where: { id }, include });
 if (!style) throw new AppError("NOT_FOUND", 404, "Shirt style not found.");
 assertVersionWrite(style.version === version ? 1 : 0); return style;
}
async function bump(tx: DbTransaction, style: LoadedStyle) {
 assertVersionWrite((await tx.merchandiseStyle.updateMany({ where: { id: style.id, version: style.version }, data: { version: { increment: 1 } } })).count);
 await tx.season.update({ where: { id: style.seasonId }, data: { version: { increment: 1 } } });
 return view(await tx.merchandiseStyle.findUniqueOrThrow({ where: { id: style.id }, include }));
}
export function createCatalogService(client: PrismaClient = db) {
 return {
  async getCatalog(ctx: RequestContext, seasonId: string): Promise<CatalogSnapshot> {
   admin(ctx); parseCatalog(idSchema, seasonId);
   return withTransaction(async tx => {
    await season(tx, seasonId);
    const styles = await tx.merchandiseStyle.findMany({ where: { seasonId }, orderBy: [{ position: "asc" }, { id: "asc" }], include });
    const sets = await tx.artworkSet.findMany({ where: { seasonId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
    return { styles: styles.map(view), artworkSets: sets.map(s => ({ id: s.id, seasonId, name: s.name, frontAssetId: s.frontAssetId, backAssetId: s.backAssetId, version: s.version })) };
   }, client);
  },
  async createStyle(ctx: RequestContext, seasonId: string, raw: unknown): Promise<CatalogStyle> {
   admin(ctx); const input = parseCatalog(createStyleSchema, raw); validateColorNames(input.colors);
   return withTransaction(async tx => {
    const parent = await season(tx, seasonId);
    if (input.templateStyleId) {
     const template = await tx.merchandiseStyle.findUnique({ where: { id: input.templateStyleId } });
     if (!template || template.seasonId !== seasonId) throw new AppError("INVALID_TEMPLATE", 422, "Choose a template from this season.");
    }
    const sets = await tx.artworkSet.findMany({ where: { seasonId }, orderBy: { position: "asc" } });
    if (!sets.length) throw new AppError("INVALID_CATALOG", 422, "Create the season's artwork set first.");
    const last = await tx.merchandiseStyle.aggregate({ where: { seasonId }, _max: { position: true } });
    const style = await tx.merchandiseStyle.create({ data: { seasonId, name: input.name, description: input.description, manufacturerUrl: input.manufacturerUrl, unitPriceCents: input.unitPriceCents, cut: input.cut, position: (last._max.position ?? -1) + 1,
     colors: { create: input.colors.map((c, position) => ({ name: c.name, normalizedName: normalizedName(c.name), hex: c.hex, position })) },
     sizes: { create: uniqueSizes(input.sizes).map((label, position) => ({ label, normalizedLabel: normalizedName(label), position })) },
     artworkSets: { create: sets.map((s, position) => ({ artworkSetId: s.id, position })) },
    }, include });
    if (parent.lifecycle === "PUBLISHED") await validateSeasonReadiness(tx, seasonId);
    await tx.season.update({ where: { id: seasonId }, data: { version: { increment: 1 } } });
    return view(style);
   }, client);
  },
  async updateStyleDetails(ctx: RequestContext, id: string, version: number, raw: unknown): Promise<CatalogStyle> {
   admin(ctx); const input = parseCatalog(styleDetailsSchema, raw);
   return withTransaction(async tx => { const style = await current(tx, id, version); await tx.merchandiseStyle.update({ where: { id }, data: input }); return bump(tx, style); }, client);
  },
  async updateStylePrice(ctx: RequestContext, id: string, version: number, cents: number): Promise<CatalogStyle> {
   admin(ctx); parseCatalog(centsSchema, cents);
   return withTransaction(async tx => { const style = await current(tx, id, version); await tx.merchandiseStyle.update({ where: { id }, data: { unitPriceCents: cents } }); return bump(tx, style); }, client);
  },
  async saveStyleColors(ctx: RequestContext, id: string, version: number, raw: unknown): Promise<CatalogStyle> {
   admin(ctx); const colors = parseCatalog(colorsSchema, raw); validateColorNames(colors);
   return withTransaction(async tx => {
    const style = await current(tx, id, version);
    for (const color of colors) if (color.id && !style.colors.some(c => c.id === color.id)) throw new AppError("INVALID_COLOR", 422, "A color no longer belongs to this shirt style.");
    const retained = new Set(colors.flatMap(c => c.id ? [c.id] : []));
    const removedColorIds = style.colors.filter(c => !retained.has(c.id)).map(c => c.id);
    if (style.orderLines.some(l => removedColorIds.includes(l.colorId))) throw new AppError("COLOR_IN_USE", 409, "A removed color is used by an order, including any cancelled order. Keep it in this style.");
    // Cascade removes only these colors' scoped photo/placement rows. Shared assets
    // stay referenced safely; unreferenced-file cleanup is the later asset service.
    await tx.styleColor.deleteMany({ where: { styleId: id, id: { in: removedColorIds } } });
    // Stage normalized names so legal swaps do not trip the unique constraint.
    for (const color of style.colors.filter(c => retained.has(c.id))) await tx.styleColor.update({ where: { id: color.id }, data: { normalizedName: `staged:${randomUUID()}` } });
    for (const [position, color] of colors.entries()) {
     const data = { name: color.name, normalizedName: normalizedName(color.name), hex: color.hex, position };
     if (color.id) await tx.styleColor.update({ where: { id: color.id }, data });
     else await tx.styleColor.create({ data: { styleId: id, ...data } });
    }
    return { ...await bump(tx, style), removedColorIds };
   }, client);
  },
  async setStyleArtworkSets(ctx: RequestContext, id: string, version: number, raw: string[]): Promise<CatalogStyle> {
   admin(ctx); const setIds = parseCatalog(z.array(idSchema).min(1).max(100), raw);
   if (new Set(setIds).size !== setIds.length) throw new AppError("INVALID_INPUT", 422, "Artwork sets must be unique.");
   return withTransaction(async tx => {
    const style = await current(tx, id, version);
    if (await tx.artworkSet.count({ where: { seasonId: style.seasonId, id: { in: setIds } } }) !== setIds.length) throw new AppError("INVALID_SET", 422, "Every artwork set must belong to this season.");
    const removedSetIds = style.artworkSets.filter(s => !setIds.includes(s.artworkSetId)).map(s => s.artworkSetId);
    await tx.styleArtworkSet.deleteMany({ where: { styleId: id } });
    for (const [position, artworkSetId] of setIds.entries()) await tx.styleArtworkSet.create({ data: { styleId: id, artworkSetId, position } });
    if ((await season(tx, style.seasonId)).lifecycle === "PUBLISHED") await validateSeasonReadiness(tx, style.seasonId);
    return { ...await bump(tx, style), removedSetIds };
   }, client);
  },
  async deleteStyle(ctx: RequestContext, id: string, version: number): Promise<void> {
   admin(ctx); return withTransaction(async tx => {
    const style = await current(tx, id, version);
    if (style.orderLines.length) throw new AppError("STYLE_IN_USE", 409, "This style is used by an order, including any cancelled order, and cannot be deleted.");
    if ((await season(tx, style.seasonId)).lifecycle === "PUBLISHED" && await tx.merchandiseStyle.count({ where: { seasonId: style.seasonId } }) <= 1) throw new AppError("LAST_PUBLISHED_STYLE", 409, "A published season must keep at least one shirt style.");
    assertVersionWrite((await tx.merchandiseStyle.deleteMany({ where: { id, version } })).count);
    await tx.season.update({ where: { id: style.seasonId }, data: { version: { increment: 1 } } });
   }, client);
  },
 };
}
export const createStyle = (ctx: RequestContext, seasonId: string, input: CreateStyleInput) => createCatalogService().createStyle(ctx, seasonId, input);
export const updateStylePrice = (ctx: RequestContext, id: string, version: number, cents: number) => createCatalogService().updateStylePrice(ctx, id, version, cents);
export const saveStyleColors = (ctx: RequestContext, id: string, version: number, colors: ColorInput[]) => createCatalogService().saveStyleColors(ctx, id, version, colors);
export const setStyleArtworkSets = (ctx: RequestContext, id: string, version: number, setIds: string[]) => createCatalogService().setStyleArtworkSets(ctx, id, version, setIds);
export const deleteStyle = (ctx: RequestContext, id: string, version: number) => createCatalogService().deleteStyle(ctx, id, version);
