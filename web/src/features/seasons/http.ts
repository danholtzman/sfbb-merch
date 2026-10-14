import { requireActor, authorizeMutation } from "../../server/authorization";
import { apiResponse, jsonData, readSmallJson } from "../../server/http";
import { createSeasonService } from "./service";
import { settingsSchema, versionInputSchema, parse } from "./validation";
export function seasonCollection(request: Request) {
  return apiResponse(async () => {
    const ctx = await requireActor(request, "admin");
    const service = createSeasonService();
    if (request.method === "GET") return jsonData(await service.listSeasons(ctx));
    await authorizeMutation(request, ctx);
    return jsonData(await service.createSeason(ctx, await readSmallJson(request, 16384)));
  });
}
export function seasonMutation(request: Request, params: Promise<{ id: string }>, operation: "update" | "delete" | "publish") {
  return apiResponse(async () => {
    const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx);
    const { id } = await params;
    const raw = await readSmallJson(request, 16384);
    const service = createSeasonService();
    if (operation === "update") {
      const input = parse(settingsSchema.extend(versionInputSchema.shape), raw);
      const { expectedVersion, ...settings } = input;
      return jsonData(await service.updateSeason(ctx, id, expectedVersion, settings));
    }
    const { expectedVersion } = parse(versionInputSchema, raw);
    return jsonData(await (operation === "publish" ? service.publishSeason(ctx, id, expectedVersion) : service.deleteSeason(ctx, id, expectedVersion)));
  });
}
