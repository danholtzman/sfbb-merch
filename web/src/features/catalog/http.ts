import { z } from "zod";
import { requireActor, authorizeMutation } from "../../server/authorization";
import { apiResponse, jsonData, readSmallJson } from "../../server/http";
import { centsSchema, versionSchema, idSchema } from "../../domain/schemas";
import { createCatalogService } from "./service";
import { colorsSchema, parseCatalog } from "./colors";
export function catalogCollection(request: Request, params: Promise<{ id: string }>) {
 return apiResponse(async () => {
  const ctx = await requireActor(request, "admin"), { id } = await params;
  const service = createCatalogService();
  if (request.method === "GET") return jsonData(await service.getCatalog(ctx, id));
  await authorizeMutation(request, ctx);
  return jsonData(await service.createStyle(ctx, id, await readSmallJson(request, 32768)));
 });
}
export function catalogMutation(request: Request, params: Promise<{ id: string }>, operation: "price" | "colors" | "sets" | "delete") {
 return apiResponse(async () => {
  const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx);
  const { id } = await params, raw = await readSmallJson(request, 32768), service = createCatalogService();
  const base = z.strictObject({ expectedVersion: versionSchema });
  if (operation === "price") { const input = parseCatalog(base.extend({ unitPriceCents: centsSchema }), raw); return jsonData(await service.updateStylePrice(ctx, id, input.expectedVersion, input.unitPriceCents)); }
  if (operation === "colors") { const input = parseCatalog(base.extend({ colors: colorsSchema }), raw); return jsonData(await service.saveStyleColors(ctx, id, input.expectedVersion, input.colors)); }
  if (operation === "sets") { const input = parseCatalog(base.extend({ setIds: z.array(idSchema).min(1).max(100) }), raw); return jsonData(await service.setStyleArtworkSets(ctx, id, input.expectedVersion, input.setIds)); }
  const { expectedVersion } = parseCatalog(base, raw); await service.deleteStyle(ctx, id, expectedVersion); return jsonData({ deletedStyleId: id });
 });
}
