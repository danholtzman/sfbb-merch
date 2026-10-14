import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase, seedCatalog, lineData } from "../fixtures/database";
import { createSeasonService, isOrderingOpen, seasonStatus } from "../../src/features/seasons/service";
import type { RequestContext, SeasonView } from "../../src/domain/types";
const ctx: RequestContext = { actor: { role: "admin", sessionId: randomUUID() }, now: new Date("2026-10-14T12:00:00Z") };
const input = { name: "Next season", opensOn: "2027-03-01", closesOn: "2027-03-31", announcement: "Rehearsal pickup", copyFromSeasonId: null, reuseArtwork: false };
let database: Awaited<ReturnType<typeof testDatabase>>;
let service: ReturnType<typeof createSeasonService>;
beforeEach(async () => { database = await testDatabase(); service = createSeasonService(database.client); });
afterEach(async () => { await database.close(); });
async function ready() {
  const c = await seedCatalog(database.client);
  const asset = await database.client.asset.create({ data: { mime: "image/png", width: 400, height: 400, byteSize: 1024, storageKey: randomUUID(), sha256: "a".repeat(64) } });
  await database.client.artworkSet.update({ where: { id: c.artwork.id }, data: { frontAssetId: asset.id, backAssetId: asset.id } });
  return { ...c, asset };
}
describe("season ordering clock", () => {
  const season: SeasonView = { id: randomUUID(), name: "Fall", opensOn: "2026-11-01", closesOn: "2026-11-01", announcement: "", lifecycle: "PUBLISHED", version: 1 };
  it("uses inclusive LA dates across the fall DST transition", () => {
    expect(isOrderingOpen(season, new Date("2026-11-01T06:59:59Z"))).toBe(false);
    expect(isOrderingOpen(season, new Date("2026-11-01T07:00:00Z"))).toBe(true);
    expect(isOrderingOpen(season, new Date("2026-11-02T07:59:59Z"))).toBe(true);
    expect(isOrderingOpen(season, new Date("2026-11-02T08:00:00Z"))).toBe(false);
  });
  it("uses the spring DST midnight and never opens drafts or archives", () => {
    const spring = { ...season, opensOn: "2027-03-14", closesOn: "2027-03-14" };
    expect(isOrderingOpen(spring, new Date("2027-03-14T07:59:59Z"))).toBe(false);
    expect(isOrderingOpen(spring, new Date("2027-03-14T08:00:00Z"))).toBe(true);
    expect(isOrderingOpen(spring, new Date("2027-03-15T07:00:00Z"))).toBe(false);
    expect(seasonStatus({ ...spring, lifecycle: "DRAFT" }, ctx.now)).toBe("Draft");
    expect(isOrderingOpen({ ...season, lifecycle: "ARCHIVED" }, new Date("2026-11-01T12:00:00Z"))).toBe(false);
  });
});
describe("season mutations", () => {
  it("creates a draft with one fresh paired artwork record, validates input and requires admin", async () => {
    const s = await service.createSeason(ctx, input);
    expect(s.lifecycle).toBe("DRAFT");
    expect(await database.client.artworkSet.findMany({ where: { seasonId: s.id } })).toMatchObject([{ frontAssetId: null, backAssetId: null }]);
    await expect(service.createSeason(ctx, { ...input, closesOn: "2027-02-30" })).rejects.toMatchObject({ status: 422 });
    await expect(service.createSeason(ctx, { ...input, closesOn: "2027-02-01" })).rejects.toMatchObject({ status: 422 });
    await expect(service.createSeason({ ...ctx, actor: { ...ctx.actor, role: "member" } }, input)).rejects.toMatchObject({ status: 403 });
  });
  it("refuses an empty catalog and reports every missing offered PNG side", async () => {
    const s = await service.createSeason(ctx, input);
    await expect(service.publishSeason(ctx, s.id, 1)).rejects.toMatchObject({ status: 422 });
    const c = await seedCatalog(database.client);
    const extra = await database.client.artworkSet.create({ data: { seasonId: c.season.id, name: "Encore", normalizedName: "encore" } });
    await database.client.styleArtworkSet.create({ data: { styleId: c.style.id, artworkSetId: extra.id, position: 1 } });
    await expect(service.publishSeason(ctx, c.season.id, 1)).rejects.toMatchObject({ fields: expect.objectContaining({ [`${c.artwork.id}.front`]: expect.any(String), [`${c.artwork.id}.back`]: expect.any(String), [`${extra.id}.front`]: expect.any(String), [`${extra.id}.back`]: expect.any(String) }) });
  });
  it("publishes without blank photos, ignoring unassigned incomplete sets; JPEG artwork blocks", async () => {
    const c = await ready();
    await database.client.artworkSet.create({ data: { seasonId: c.season.id, name: "Unused", normalizedName: "unused" } });
    await database.client.asset.update({ where: { id: c.asset.id }, data: { mime: "image/jpeg" } });
    await expect(service.publishSeason(ctx, c.season.id, 1)).rejects.toMatchObject({ status: 422 });
    await database.client.asset.update({ where: { id: c.asset.id }, data: { mime: "image/png" } });
    expect(await service.publishSeason(ctx, c.season.id, 1)).toMatchObject({ lifecycle: "PUBLISHED", version: 2 });
  });
  it("blocks overlapping published dates including a shared day, allows drafts, and checks published edits", async () => {
    const c = await ready();
    await service.publishSeason(ctx, c.season.id, 1);
    const s = await service.createSeason(ctx, { ...input, opensOn: "2026-10-31", closesOn: "2026-11-30", copyFromSeasonId: c.season.id, reuseArtwork: true });
    await expect(service.publishSeason(ctx, s.id, 1)).rejects.toMatchObject({ code: "SEASON_OVERLAP" });
    const changed = await service.updateSeason(ctx, s.id, 1, { name: s.name, opensOn: "2026-11-01", closesOn: "2026-11-30", announcement: "" });
    await service.publishSeason(ctx, changed.id, changed.version);
    await expect(service.updateSeason(ctx, c.season.id, 2, { ...c.season, closesOn: "2026-11-01" })).rejects.toMatchObject({ status: 422 });
    await expect(service.updateSeason(ctx, c.season.id, 2, { name: c.season.name, opensOn: "2026-10-01", closesOn: "2026-11-01", announcement: "" })).rejects.toMatchObject({ code: "SEASON_OVERLAP" });
  });
  it("serializes competing publications and rejects stale settings", async () => {
    const c = await ready();
    const other = await service.createSeason(ctx, { ...input, opensOn: c.season.opensOn, closesOn: c.season.closesOn, copyFromSeasonId: c.season.id, reuseArtwork: true });
    const results = await Promise.allSettled([service.publishSeason(ctx, c.season.id, 1), service.publishSeason(ctx, other.id, 1)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await database.client.season.count({ where: { lifecycle: "PUBLISHED" } })).toBe(1);
    await expect(service.updateSeason(ctx, other.id, 99, { name: "Stale", opensOn: input.opensOn, closesOn: input.closesOn, announcement: "" })).rejects.toMatchObject({ code: "STALE_VERSION" });
  });
  it("copies definitions/photos with new IDs, fresh artwork by default; explicit reuse maps placements without orders", async () => {
    const c = await ready();
    await database.client.blankPhoto.create({ data: { styleId: c.style.id, colorId: c.color.id, scopeKey: c.color.id, side: "back", assetId: c.asset.id } });
    await database.client.placement.create({ data: { styleId: c.style.id, artworkSetId: c.artwork.id, colorId: c.color.id, scopeKey: c.color.id, side: "back", x: 50, y: 40, width: 30, rotation: 5 } });
    await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Test", code: "ABC123", lines: { create: lineData(c) } } });
    for (const reuseArtwork of [false, true]) {
      const copy = await service.createSeason(ctx, { ...input, copyFromSeasonId: c.season.id, reuseArtwork });
      const style = await database.client.merchandiseStyle.findFirstOrThrow({ where: { seasonId: copy.id }, include: { colors: true, sizes: true, blankPhotos: true, placements: true, artworkSets: { include: { artworkSet: true } } } });
      expect(style.id).not.toBe(c.style.id);
      expect(style).toMatchObject({ name: c.style.name, unitPriceCents: 2510, cut: "classic" });
      expect(style.colors[0].id).not.toBe(c.color.id);
      expect(style.sizes[0].id).not.toBe(c.size.id);
      expect(style.blankPhotos[0]).toMatchObject({ assetId: c.asset.id, colorId: style.colors[0].id, scopeKey: style.colors[0].id });
      expect(style.artworkSets[0].artworkSet.frontAssetId).toBe(reuseArtwork ? c.asset.id : null);
      expect(style.placements).toHaveLength(reuseArtwork ? 1 : 0);
      if (reuseArtwork) expect(style.placements[0]).toMatchObject({ colorId: style.colors[0].id, scopeKey: style.colors[0].id, artworkSetId: style.artworkSets[0].artworkSetId, rotation: 5 });
      expect(await database.client.order.count({ where: { seasonId: copy.id } })).toBe(0);
    }
  });
  it("protects cancelled-order references and the last season; safely removes a copied season and picks open published", async () => {
    const c = await ready();
    await expect(service.deleteSeason(ctx, c.season.id, 1)).rejects.toMatchObject({ code: "LAST_SEASON" });
    await service.publishSeason(ctx, c.season.id, 1);
    const copy = await service.createSeason(ctx, { ...input, copyFromSeasonId: c.season.id, reuseArtwork: true });
    await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Cancelled", code: "ABC123", cancelled: true, lines: { create: lineData(c) } } });
    await expect(service.deleteSeason(ctx, c.season.id, 2)).rejects.toMatchObject({ code: "SEASON_HAS_ORDERS" });
    expect(await service.deleteSeason(ctx, copy.id, 1)).toEqual({ selectedSeasonId: c.season.id });
    expect(await database.client.merchandiseStyle.count({ where: { seasonId: copy.id } })).toBe(0);
    expect(await database.client.asset.count()).toBe(1);
    expect(await database.client.orderLine.count()).toBe(1);
  });
});
