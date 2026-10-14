import { z } from "zod";
import { requireActor, authorizeMutation, trustedClientAddress } from "../../server/authorization";
import { readConfig } from "../../server/config";
import { apiResponse, jsonData, readSmallJson } from "../../server/http";
import { versionSchema, progressSchema, idSchema } from "../../domain/schemas";
import { parseOrder, memberEditSchema, adminEditSchema } from "./validation";
import { createMemberData } from "./member-data";
import { runtimeOrders, type OrderContext } from "./service";
function service(request: Request) { return runtimeOrders(trustedClientAddress(request, readConfig(process.env))); }
function preview(request: Request): boolean {
 if (request.headers.get("X-SFBB-Preview") === "1" || new URL(request.url).searchParams.has("previewSeasonId")) return true;
 try { const referring = new URL(request.headers.get("Referer") ?? ""); return referring.origin === readConfig(process.env).publicOrigin && referring.searchParams.has("previewSeasonId"); } catch { return false; }
}
export function orderSubmit(request: Request) {
 return apiResponse(async () => { const ctx: OrderContext = await requireActor(request); await authorizeMutation(request, ctx); ctx.preview = preview(request); ctx.expectedCatalogVersion = catalogVersion(request);
 return jsonData(await service(request).submitOrder(ctx, await readSmallJson(request, 65536), request.headers.get("Idempotency-Key") ?? "")); });
}
export function orderLookup(request: Request) {
 return apiResponse(async () => { const ctx = await requireActor(request); await authorizeMutation(request, ctx); const { code } = parseOrder(z.strictObject({ code: z.string().max(128) }), await readSmallJson(request)); return jsonData(await createMemberData().present(ctx, await service(request).lookupOrder(ctx, code))); });
}
export function memberOrderMutation(request: Request, params: Promise<{ code: string }>, operation: "edit" | "cancel" | "restore") {
 return apiResponse(async () => { const ctx: OrderContext = await requireActor(request); await authorizeMutation(request, ctx); ctx.expectedCatalogVersion = catalogVersion(request); const { code } = await params;
 const orders = service(request), raw = await readSmallJson(request, 65536);
 if (operation === "edit") { const { expectedVersion, ...input } = parseOrder(memberEditSchema.extend({ expectedVersion: versionSchema }), raw); return jsonData(await orders.editMemberOrder(ctx, code, expectedVersion, input)); }
 const { expectedVersion } = parseOrder(z.strictObject({ expectedVersion: versionSchema }), raw);
 return jsonData(await (operation === "cancel" ? orders.cancelOrder(ctx, code, expectedVersion) : orders.restoreOrder(ctx, code, expectedVersion))); });
}
export function adminOrders(request: Request) {
 return apiResponse(async () => { const ctx = await requireActor(request, "admin"), query = new URL(request.url).searchParams; const seasonId = parseOrder(idSchema, query.get("seasonId")); return jsonData(await service(request).listOrders(ctx, seasonId, query.get("search") ?? "")); });
}
export function adminOrderMutation(request: Request, params: Promise<{ id: string }>, operation: "edit" | "cancel" | "restore" | "progress") {
 return apiResponse(async () => { const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx); const { id } = await params; parseOrder(idSchema, id);
 const raw = await readSmallJson(request, 65536), orders = service(request), base = z.strictObject({ expectedVersion: versionSchema });
 if (operation === "edit") { const { expectedVersion, ...input } = parseOrder(adminEditSchema.extend(base.shape), raw); return jsonData(await orders.editAdminOrder(ctx, id, expectedVersion, input)); }
 if (operation === "progress") { const { expectedVersion, progress } = parseOrder(base.extend({ progress: progressSchema }), raw); return jsonData(await orders.setOrderProgress(ctx, id, expectedVersion, progress)); }
 const { expectedVersion } = parseOrder(base, raw); return jsonData(await (operation === "cancel" ? orders.cancelOrder(ctx, id, expectedVersion) : orders.restoreOrder(ctx, id, expectedVersion))); });
}

function catalogVersion(request: Request) { const value = request.headers.get("X-SFBB-Catalog-Version"); return value === null ? undefined : parseOrder(z.string().regex(/^\d+$/).transform(Number).pipe(versionSchema), value); }
export function memberCatalog(request: Request) {
 return apiResponse(async () => { const ctx = await requireActor(request), query = new URL(request.url).searchParams;
 const previewId = query.has("previewSeasonId") ? parseOrder(idSchema, query.get("previewSeasonId")) : undefined;
 return jsonData(await createMemberData().shop(ctx, previewId)); });
}
