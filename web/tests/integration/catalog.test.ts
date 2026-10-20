import { beforeEach, afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase, seedCatalog, lineData } from "../fixtures/database";
import { createCatalogService } from "../../src/features/catalog/service";
import type { RequestContext } from "../../src/domain/types";
const ctx: RequestContext = { actor: { role: "admin", sessionId: randomUUID() }, now: new Date("2026-10-14T12:00:00Z") };
const input = { name: "  Youth tee  ", description: " Soft cotton ", unitPriceCents: 0, cut: "classic" as const, colors: [{ name: " Band blue ", hex: "#1349df" }], sizes: [" Youth S ", "4XL", "Youth S", " 4xl ", "M"] };
let database: Awaited<ReturnType<typeof testDatabase>>;
let service: ReturnType<typeof createCatalogService>;
beforeEach(async () => { database = await testDatabase(); service = createCatalogService(database.client); });
afterEach(async () => { await database.close(); });
it("creates custom styles with trimmed names, arbitrary ordered deduplicated sizes, zero price, and all season sets", async () => {
  const c = await seedCatalog(database.client);
  const extra = await database.client.artworkSet.create({ data: { seasonId: c.season.id, name: "Encore", normalizedName: "encore" } });
  const style = await service.createStyle(ctx, c.season.id, input);
  expect(style).toMatchObject({ name: "Youth tee", description: "Soft cotton", unitPriceCents: 0, colors: [{ name: "Band blue", hex: "#1349DF" }] });
  expect(style.sizes.map(s => s.label)).toEqual(["Youth S", "4XL", "M"]);
  expect(style.artworkSetIds).toEqual(expect.arrayContaining([c.artwork.id, extra.id]));
  await expect(service.createStyle({ ...ctx, actor: { ...ctx.actor, role: "member" } }, c.season.id, input)).rejects.toMatchObject({ status: 403 });
});
it("rejects empty colors/sizes, duplicate normalized colors, invalid hex and fractional cents", async () => {
  const c = await seedCatalog(database.client);
  for (const invalid of [ { ...input, colors: [] }, { ...input, sizes: [" "] }, { ...input, colors: [{ name: "Blue", hex: "#123456" }, { name: " blue ", hex: "#654321" }] }, { ...input, colors: [{ name: "Blue", hex: "red" }] }, { ...input, unitPriceCents: 2.5 } ]) await expect(service.createStyle(ctx, c.season.id, invalid)).rejects.toMatchObject({ status: 422 });
  expect(await database.client.merchandiseStyle.count()).toBe(1);
});
it("changes price and current colors without modifying historical snapshots, including cancelled orders", async () => {
  const c = await seedCatalog(database.client);
  await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Cancelled", code: "ABC123", cancelled: true, lines: { create: lineData(c) } } });
  const priced = await service.updateStylePrice(ctx, c.style.id, 1, 0);
  const edited = await service.saveStyleColors(ctx, c.style.id, priced.version, [{ id: c.color.id, name: " Midnight ", hex: "#000001" }]);
  expect(edited.colors[0]).toMatchObject({ id: c.color.id, name: "Midnight", hex: "#000001" });
  const line = await database.client.orderLine.findFirstOrThrow();
  expect(line).toMatchObject({ unitPriceCents: 2510, styleName: "Classic Tee", colorName: "Blue", colorHex: "#1247ED", sizeLabel: "L" });
  await expect(service.deleteStyle(ctx, c.style.id, edited.version)).rejects.toMatchObject({ code: "STYLE_IN_USE" });
  await expect(service.saveStyleColors(ctx, c.style.id, edited.version, [{ name: "Other", hex: "#FFFFFF" }])).rejects.toMatchObject({ code: "COLOR_IN_USE" });
});
it("removes only unused colors and their scoped photos/placements, retaining remaining IDs and shared assets", async () => {
  const c = await seedCatalog(database.client);
  const extra = await database.client.styleColor.create({ data: { styleId: c.style.id, name: "Black", normalizedName: "black", hex: "#000000", position: 1 } });
  const asset = await database.client.asset.create({ data: { mime: "image/png", width: 400, height: 400, byteSize: 1024, storageKey: randomUUID(), sha256: "a".repeat(64) } });
  for (const colorId of [c.color.id, extra.id, null]) {
    await database.client.blankPhoto.create({ data: { styleId: c.style.id, colorId, scopeKey: colorId ?? "all", side: "front", assetId: asset.id } });
    await database.client.placement.create({ data: { styleId: c.style.id, artworkSetId: c.artwork.id, colorId, scopeKey: colorId ?? "all", side: "front", x: 50, y: 50, width: 30, rotation: 0 } });
  }
  const result = await service.saveStyleColors(ctx, c.style.id, 1, [{ id: extra.id, name: "Black", hex: "#000000" }, { name: "White", hex: "#FFFFFF" }]);
  expect(result.removedColorIds).toEqual([c.color.id]);
  expect(result.colors[0]).toMatchObject({ id: extra.id, position: 0 });
  expect(await database.client.blankPhoto.count()).toBe(2);
  expect(await database.client.placement.count()).toBe(2);
  expect(await database.client.asset.count()).toBe(1);
});
it("saves color renames/swaps atomically and rejects foreign/duplicate IDs and last-color removal", async () => {
  const c = await seedCatalog(database.client);
  const other = await seedCatalog(database.client);
  const added = await service.saveStyleColors(ctx, c.style.id, 1, [{ id: c.color.id, name: "Blue", hex: "#1247ED" }, { name: "Black", hex: "#000000" }]);
  const black = added.colors[1];
  const swapped = await service.saveStyleColors(ctx, c.style.id, added.version, [{ id: c.color.id, name: "Black", hex: "#000000" }, { id: black.id, name: "Blue", hex: "#1247ED" }]);
  expect(swapped.colors.map(c => c.name)).toEqual(["Black", "Blue"]);
  for (const colors of [[], [{ id: other.color.id, name: "Other", hex: "#000000" }], [{ id: black.id, name: "A", hex: "#000000" }, { id: black.id, name: "B", hex: "#111111" }]]) await expect(service.saveStyleColors(ctx, c.style.id, swapped.version, colors)).rejects.toMatchObject({ status: 422 });
  expect((await database.client.styleColor.findMany({ where: { styleId: c.style.id }, orderBy: { position: "asc" } })).map(c => c.name)).toEqual(["Black", "Blue"]);
});
it("rejects cross-season sets and the last set; removes availability without rewriting ordered variants", async () => {
  const c = await seedCatalog(database.client), other = await seedCatalog(database.client);
  await expect(service.setStyleArtworkSets(ctx, c.style.id, 1, [other.artwork.id])).rejects.toMatchObject({ status: 422 });
  await expect(service.setStyleArtworkSets(ctx, c.style.id, 1, [])).rejects.toMatchObject({ status: 422 });
  await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Member", code: "ABC123", lines: { create: lineData(c) } } });
  const extra = await database.client.artworkSet.create({ data: { seasonId: c.season.id, name: "Encore", normalizedName: "encore" } });
  const result = await service.setStyleArtworkSets(ctx, c.style.id, 1, [extra.id]);
  expect(result.removedSetIds).toEqual([c.artwork.id]);
  expect(await database.client.orderLine.count()).toBe(1);
});
it("allows blank artwork after publication while protecting the last published style", async () => {
  const c = await seedCatalog(database.client);
  await database.client.season.update({ where: { id: c.season.id }, data: { lifecycle: "PUBLISHED" } });
  const extra = await database.client.artworkSet.create({ data: { seasonId: c.season.id, name: "Missing", normalizedName: "missing" } });
  const updated=await service.setStyleArtworkSets(ctx, c.style.id, 1, [extra.id]);
  const added=await service.createStyle(ctx, c.season.id, input);
  await service.deleteStyle(ctx,added.id,added.version);
  await expect(service.deleteStyle(ctx, c.style.id, updated.version)).rejects.toMatchObject({ code: "LAST_PUBLISHED_STYLE" });
});
it("deletes unused styles and dependents while retaining artwork and other styles", async () => {
  const c = await seedCatalog(database.client);
  const added = await service.createStyle(ctx, c.season.id, input);
  await service.deleteStyle(ctx, added.id, added.version);
  expect(await database.client.merchandiseStyle.count()).toBe(1);
  expect(await database.client.styleColor.count()).toBe(1);
  expect(await database.client.artworkSet.count()).toBe(1);
});
it("rejects stale writes and serializes competing color changes", async () => {
  const c = await seedCatalog(database.client);
  const results = await Promise.allSettled([service.updateStylePrice(ctx, c.style.id, 1, 100), service.saveStyleColors(ctx, c.style.id, 1, [{ id: c.color.id, name: "New", hex: "#000000" }])]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "STALE_VERSION" } });
});

it("persists an optional manufacturer URL and rejects unsafe links", async () => {
 const c = await seedCatalog(database.client);
 const style = await service.createStyle(ctx, c.season.id, { ...input, manufacturerUrl: " https://example.com/shirts?fit=classic " });
 expect(style).toMatchObject({ manufacturerUrl: "https://example.com/shirts?fit=classic" });
 expect((await service.getCatalog(ctx, c.season.id)).styles.find(s => s.id === style.id)).toMatchObject({ manufacturerUrl: "https://example.com/shirts?fit=classic" });
 for (const manufacturerUrl of ["javascript:alert(1)", "ftp://example.com", "not a URL"]) await expect(service.createStyle(ctx, c.season.id, { ...input, manufacturerUrl })).rejects.toMatchObject({ status: 422 });
 expect(await service.createStyle(ctx, c.season.id, input)).toMatchObject({ manufacturerUrl: "" });
});

it("edits and clears manufacturer details with administrator and version checks", async () => {
 const c = await seedCatalog(database.client);
 const details = { description: " Updated cotton ", manufacturerUrl: "https://example.com/tee" };
 const updated = await service.updateStyleDetails(ctx, c.style.id, 1, details);
 expect(updated).toMatchObject({ description: "Updated cotton", manufacturerUrl: details.manufacturerUrl, version: 2 });
 await expect(service.updateStyleDetails(ctx, c.style.id, 1, details)).rejects.toMatchObject({ code: "STALE_VERSION" });
 await expect(service.updateStyleDetails({ ...ctx, actor: { ...ctx.actor, role: "member" } }, c.style.id, 2, details)).rejects.toMatchObject({ status: 403 });
 await expect(service.updateStyleDetails(ctx, c.style.id, 2, { ...details, manufacturerUrl: "javascript:alert(1)" })).rejects.toMatchObject({ status: 422 });
 expect(await service.updateStyleDetails(ctx, c.style.id, 2, { description: updated.description, manufacturerUrl: " " })).toMatchObject({ manufacturerUrl: "", version: 3 });
});
it("creates selected artwork availability and per-color photos together, rejecting invalid drafts atomically", async()=>{
 const c=await seedCatalog(database.client),other=await seedCatalog(database.client);
 const asset=await database.client.asset.create({data:{mime:"image/jpeg",width:100,height:100,byteSize:1024,storageKey:randomUUID(),sha256:"a".repeat(64)}});
 const raw={...input,artworkSetIds:[c.artwork.id],blankPhotos:[{colorPosition:0,side:"front",assetId:asset.id}]};
 const style=await service.createStyle(ctx,c.season.id,raw);
 expect(style.artworkSetIds).toEqual([c.artwork.id]);
 expect(await database.client.blankPhoto.findMany({where:{styleId:style.id}})).toMatchObject([{colorId:style.colors[0].id,scopeKey:style.colors[0].id,side:"front",assetId:asset.id}]);
 const count=await database.client.merchandiseStyle.count();
 for(const invalid of [{...raw,artworkSetIds:[]},{...raw,artworkSetIds:[other.artwork.id]},{...raw,artworkSetIds:[c.artwork.id,c.artwork.id]},{...raw,blankPhotos:[{...raw.blankPhotos[0],colorPosition:1}]},{...raw,blankPhotos:[{...raw.blankPhotos[0],assetId:randomUUID()}]},{...raw,blankPhotos:[...raw.blankPhotos,...raw.blankPhotos]}]) await expect(service.createStyle(ctx,c.season.id,invalid)).rejects.toMatchObject({status:422});
 expect(await database.client.merchandiseStyle.count()).toBe(count);
});
