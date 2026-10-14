import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import type { RequestContext, OrderView, OrderLineInput, Progress } from "../../domain/types";
import { AppError } from "../../domain/errors";
import { db, withTransaction, assertVersionWrite, type DbTransaction } from "../../server/db";
import { idSchema, versionSchema, progressSchema, centsSchema } from "../../domain/schemas";
import { isRateLimited, recordFailure } from "../../server/rate-limit";
import { isOrderingOpen } from "../seasons/clock";
import { generateOrderCode, normalizeCode } from "./code";
import { mergeCartLines, cartTotal, variantKey } from "./cart";
import { submitSchema, memberEditSchema, adminEditSchema, idempotencySchema, parseOrder, type SubmitOrderInput, type MemberEditInput, type AdminEditInput } from "./validation";
const include = { lines: { orderBy: { position: "asc" } }, season: true } as const;
type LoadedOrder = Prisma.OrderGetPayload<{ include: typeof include }>;
type Prepared = OrderLineInput & { unitPriceCents: number; styleName: string; artworkSetName: string; colorName: string; colorHex: string; sizeLabel: string; originalLineId?: string };
export type OrderContext = RequestContext & { preview?: boolean; expectedCatalogVersion?: number };
const missing = () => new AppError("ORDER_NOT_FOUND", 404, "Order not found. Check the six-character code and try again.");
function admin(ctx: RequestContext) { if (ctx.actor.role !== "admin") throw new AppError("FORBIDDEN", 403, "Administrator access is required."); }
function view(order: LoadedOrder): OrderView {
 return { id: order.id, code: order.code, seasonId: order.seasonId, fullName: order.fullName, note: order.note, progress: order.progress, cancelled: order.cancelled, version: order.version, lines: order.lines.map(l => ({ id: l.id, styleId: l.styleId, artworkSetId: l.artworkSetId, colorId: l.colorId, sizeId: l.sizeId, quantity: l.quantity, unitPriceCents: l.unitPriceCents, styleName: l.styleName, artworkSetName: l.artworkSetName, colorName: l.colorName, colorHex: l.colorHex, sizeLabel: l.sizeLabel })), amountOwedCents: order.cancelled || order.progress === "COMPLETE" ? 0 : cartTotal(order.lines) };
}
async function session(tx: DbTransaction, ctx: RequestContext, now: Date) {
 if (!Number.isFinite(now.getTime())) throw new AppError("INVALID_DATE", 422, "Invalid server time.");
 const record = await tx.session.findFirst({ where: { id: ctx.actor.sessionId, role: ctx.actor.role, expiresAt: { gt: now } } });
 if (!record) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to continue."); return record;
}
async function findOrder(tx: DbTransaction, ctx: RequestContext, key: string, version?: number) {
 const byId = ctx.actor.role === "admin" && idSchema.safeParse(key).success;
 const code = normalizeCode(key);
 if (!byId && !code) throw missing();
 const order = await tx.order.findUnique({ where: byId ? { id: key } : { code: code! }, include }); if (!order) throw missing();
 if (version !== undefined) { parseOrder(versionSchema, version); assertVersionWrite(order.version === version ? 1 : 0); } return order;
}
function memberMayChange(ctx: RequestContext, order: LoadedOrder, now: Date) {
 if (ctx.actor.role !== "admin" && (!isOrderingOpen(order.season, now) || order.progress !== "OPEN")) throw new AppError("ORDER_LOCKED", 409, "This order is locked. Contact an administrator to make changes.");
}
async function newLine(tx: DbTransaction, seasonId: string, input: OrderLineInput): Promise<Prepared> {
 const style = await tx.merchandiseStyle.findFirst({ where: { id: input.styleId, seasonId }, include: { colors: true, sizes: true, artworkSets: { include: { artworkSet: { include: { frontAsset: true, backAsset: true } } } } } });
 const color = style?.colors.find(c => c.id === input.colorId), size = style?.sizes.find(s => s.id === input.sizeId), set = style?.artworkSets.find(s => s.artworkSetId === input.artworkSetId)?.artworkSet;
 if (!style || !color || !size || !set || set.seasonId !== seasonId || set.frontAsset?.mime !== "image/png" || set.backAsset?.mime !== "image/png") throw new AppError("INVALID_VARIANT", 422, "A selected shirt variant is no longer available in this season. Refresh your bag.");
 return { ...input, unitPriceCents: style.unitPriceCents, styleName: style.name, artworkSetName: set.name, colorName: color.name, colorHex: color.hex, sizeLabel: size.label };
}
export function createOrderService(client: PrismaClient = db, options: { generateCode?: () => string; now?: () => Date; address?: string } = {}) {
 const clock = (ctx: RequestContext) => options.now?.() ?? ctx.now;
 const lookupBucket = (ctx: RequestContext) => `lookup:${ctx.actor.sessionId}:${createHash("sha256").update(options.address ?? "untrusted").digest("hex")}`;
 async function mutation(ctx: RequestContext, work: (tx: DbTransaction, now: Date) => Promise<OrderView>): Promise<OrderView> {
  const outcome = await withTransaction(async tx => {
   const now = clock(ctx); await session(tx, ctx, now);
   const bucket = lookupBucket(ctx);
   if (ctx.actor.role === "member" && await isRateLimited(tx, bucket, now, 10)) return { error: new AppError("LOOKUP_THROTTLED", 429, "Too many failed lookups. Please try again in 15 minutes.") };
   try { return { order: await work(tx, now) }; }
   catch (error) {
    if (ctx.actor.role === "member" && error instanceof AppError && error.code === "ORDER_NOT_FOUND") { await recordFailure(tx, bucket, now, 15*60*1000); return { error }; }
    throw error;
   }
  }, client);
  if (outcome.error) throw outcome.error; return outcome.order!;
 }

 async function edit(ctx: OrderContext, key: string, expectedVersion: number, raw: unknown, asAdmin: boolean) {
  if (asAdmin) admin(ctx);
  const input = asAdmin ? parseOrder(adminEditSchema, raw) : parseOrder(memberEditSchema, raw);
  return mutation(ctx, async (tx, now) => {
   const order = await findOrder(tx, ctx, key, expectedVersion); memberMayChange(ctx, order, now);
   if (!asAdmin && ctx.expectedCatalogVersion !== undefined && order.season.version !== ctx.expectedCatalogVersion) throw new AppError("CATALOG_CHANGED", 409, "The collection changed. Review your bag before saving.");
   if (!asAdmin && order.cancelled) throw new AppError("ORDER_CANCELLED", 409, "Restore this order before editing it.");
   const seen = new Set<string>(), rows: Prepared[] = [];
   for (const line of input.lines) {
    let original: LoadedOrder["lines"][number] | undefined;
    if (line.originalLineId) {
     if (seen.has(line.originalLineId)) throw new AppError("INVALID_INPUT", 422, "An original item may appear only once."); seen.add(line.originalLineId);
     original = order.lines.find(l => l.id === line.originalLineId); if (!original) throw new AppError("INVALID_INPUT", 422, "An original item does not belong to this order.");
    }
    const row: Prepared = original && variantKey(original) === variantKey(line) ? { styleId: original.styleId, artworkSetId: original.artworkSetId, colorId: original.colorId, sizeId: original.sizeId, quantity: line.quantity, unitPriceCents: original.unitPriceCents, styleName: original.styleName, artworkSetName: original.artworkSetName, colorName: original.colorName, colorHex: original.colorHex, sizeLabel: original.sizeLabel } : await newLine(tx, order.seasonId, line);
    if (asAdmin) row.unitPriceCents = parseOrder(centsSchema, "unitPriceCents" in line ? line.unitPriceCents : undefined);
    if (original) row.originalLineId = original.id;
    rows.push(row);
   }
   const prepared = mergeCartLines(rows); cartTotal(prepared);
   assertVersionWrite((await tx.order.updateMany({ where: { id: order.id, version: expectedVersion }, data: { fullName: input.fullName, note: input.note, version: { increment: 1 } } })).count);
   await tx.orderLine.deleteMany({ where: { orderId: order.id, id: { notIn: prepared.flatMap(l => l.originalLineId ? [l.originalLineId] : []) } } });
   for (const [position, row] of prepared.entries()) { const { originalLineId, ...data } = row; if (originalLineId) await tx.orderLine.update({ where: { id: originalLineId }, data: { ...data, position } }); else await tx.orderLine.create({ data: { orderId: order.id, ...data, position } }); }
   return view(await tx.order.findUniqueOrThrow({ where: { id: order.id }, include }));
  });
 }
 async function cancellation(ctx: RequestContext, key: string, version: number, cancelled: boolean) {
  return mutation(ctx, async (tx, now) => { const order = await findOrder(tx, ctx, key, version); memberMayChange(ctx, order, now);
   if (order.cancelled === cancelled) return view(order);
   assertVersionWrite((await tx.order.updateMany({ where: { id: order.id, version }, data: { cancelled, version: { increment: 1 } } })).count);
   return view(await tx.order.findUniqueOrThrow({ where: { id: order.id }, include }));
  });
 }
 return {
  async submitOrder(ctx: OrderContext, raw: unknown, idempotencyKey: string): Promise<OrderView> {
   const input = parseOrder(submitSchema, raw), key = parseOrder(idempotencySchema, idempotencyKey);
   const lines = mergeCartLines(input.lines);
   const canonical = { seasonId: input.seasonId, fullName: input.fullName, note: input.note, lines: [...lines].sort((a,b) => variantKey(a).localeCompare(variantKey(b))) };
   const requestHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
   return withTransaction(async tx => {
    const now = clock(ctx), live = await session(tx, ctx, now);
    if (ctx.preview) throw new AppError("PREVIEW_ONLY", 403, "Preview only — checkout unavailable.");
    const previous = await tx.idempotencyRecord.findUnique({ where: { sessionId_key: { sessionId: live.id, key } } });
    if (previous) { if (previous.requestHash !== requestHash) throw new AppError("IDEMPOTENCY_CONFLICT", 409, "This checkout key was already used with a different order."); return JSON.parse(previous.responseJson) as OrderView; }
    const season = await tx.season.findUnique({ where: { id: input.seasonId } });
    if (!season || !isOrderingOpen(season, now)) throw new AppError("ORDERING_CLOSED", 409, "This season is not accepting orders.");
    if (ctx.expectedCatalogVersion !== undefined && season.version !== ctx.expectedCatalogVersion) throw new AppError("CATALOG_CHANGED", 409, "The collection changed. Review your bag before ordering.");
    const prepared: Prepared[] = []; for (const line of lines) prepared.push(await newLine(tx, season.id, line)); cartTotal(prepared);
    let code: string | null = null;
    for (let i=0;i<20;i++) { const candidate = (options.generateCode ?? generateOrderCode)(); if (!normalizeCode(candidate) || normalizeCode(candidate) !== candidate) throw new AppError("CODE_UNAVAILABLE", 503, "Unable to assign an order code. Please try again."); if (!await tx.order.findUnique({ where: { code: candidate }, select: { id: true } })) { code = candidate; break; } }
    if (!code) throw new AppError("CODE_UNAVAILABLE", 503, "Unable to assign an order code. Please try again.");
    const order = await tx.order.create({ data: { seasonId: season.id, code, fullName: input.fullName, note: input.note, lines: { create: prepared.map((line, position) => ({ ...line, position })) } }, include });
    const result = view(order);
    await tx.idempotencyRecord.create({ data: { sessionId: live.id, key, requestHash, responseJson: JSON.stringify(result), responseStatus: 200, orderId: order.id, expiresAt: live.expiresAt } }); return result;
   }, client);
  },
  async lookupOrder(ctx: RequestContext, rawCode: string): Promise<OrderView> {
   const bucket = lookupBucket(ctx);
   const outcome = await withTransaction(async tx => {
    const now = clock(ctx); await session(tx, ctx, now);
    if (await isRateLimited(tx, bucket, now, 10)) return { error: new AppError("LOOKUP_THROTTLED", 429, "Too many failed lookups. Please try again in 15 minutes.") };
    const code = normalizeCode(rawCode), order = code ? await tx.order.findUnique({ where: { code }, include }) : null;
    if (!order) { await recordFailure(tx, bucket, now, 15*60*1000); return { error: missing() }; } return { order: view(order) };
   }, client);
   if (outcome.error) throw outcome.error; return outcome.order!;
  },
  editMemberOrder: (ctx: RequestContext, code: string, version: number, input: unknown) => edit(ctx, code, version, input, false),
  editAdminOrder: (ctx: RequestContext, id: string, version: number, input: unknown) => edit(ctx, id, version, input, true),
  cancelOrder: (ctx: RequestContext, key: string, version: number) => cancellation(ctx, key, version, true),
  restoreOrder: (ctx: RequestContext, key: string, version: number) => cancellation(ctx, key, version, false),
  async setOrderProgress(ctx: RequestContext, id: string, version: number, rawProgress: Progress): Promise<OrderView> {
   admin(ctx); parseOrder(idSchema, id); const progress = parseOrder(progressSchema, rawProgress);
   return withTransaction(async tx => { const now = clock(ctx); await session(tx, ctx, now); const order = await findOrder(tx, ctx, id, version);
    if (order.cancelled) throw new AppError("ORDER_CANCELLED", 409, "Restore this order before changing its progress.");
    assertVersionWrite((await tx.order.updateMany({ where: { id, version }, data: { progress, version: { increment: 1 } } })).count);
    return view(await tx.order.findUniqueOrThrow({ where: { id }, include }));
   }, client);
  },
  async listOrders(ctx: RequestContext, seasonId: string, search = ""): Promise<OrderView[]> {
   admin(ctx); parseOrder(idSchema, seasonId); if (search.length > 128) throw new AppError("INVALID_INPUT", 422, "Search is too long.");
   return withTransaction(async tx => { await session(tx, ctx, clock(ctx)); const rows = await tx.order.findMany({ where: { seasonId }, orderBy: [{ fullName: "asc" }, { code: "asc" }], include }); const needle = search.normalize("NFKC").trim().toLowerCase(); return rows.filter(o => o.fullName.normalize("NFKC").toLowerCase().includes(needle) || o.code.toLowerCase().includes(needle)).map(view); }, client);
  },
 };
}
export function runtimeOrders(address = "untrusted") { return createOrderService(db, { now: () => new Date(), address }); }
export const submitOrder = (ctx: OrderContext, input: SubmitOrderInput, key: string) => runtimeOrders().submitOrder(ctx, input, key);
export const lookupOrder = (ctx: RequestContext, code: string) => runtimeOrders().lookupOrder(ctx, code);
export const editMemberOrder = (ctx: RequestContext, code: string, version: number, input: MemberEditInput) => runtimeOrders().editMemberOrder(ctx, code, version, input);
export const editAdminOrder = (ctx: RequestContext, id: string, version: number, input: AdminEditInput) => runtimeOrders().editAdminOrder(ctx, id, version, input);
export const cancelOrder = (ctx: RequestContext, key: string, version: number) => runtimeOrders().cancelOrder(ctx, key, version);
export const restoreOrder = (ctx: RequestContext, key: string, version: number) => runtimeOrders().restoreOrder(ctx, key, version);
export const setOrderProgress = (ctx: RequestContext, id: string, version: number, progress: Progress) => runtimeOrders().setOrderProgress(ctx, id, version, progress);
