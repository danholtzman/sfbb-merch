import { beforeEach, afterEach, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { readFile, mkdir, symlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { testDatabase, seedCatalog, lineData } from "../fixtures/database";
import { createAssetStore } from "../../src/features/artwork/assets";
import { createArtworkService } from "../../src/features/artwork/service";
import { createSeasonService } from "../../src/features/seasons/service";
import type { RequestContext } from "../../src/domain/types";
const ctx: RequestContext = { actor: { role: "admin", sessionId: randomUUID() }, now: new Date("2026-10-14T12:00:00Z") };
let database: Awaited<ReturnType<typeof testDatabase>>, store: ReturnType<typeof createAssetStore>, service: ReturnType<typeof createArtworkService>;
beforeEach(async () => { database = await testDatabase(); store = createAssetStore({ client: database.client, dataDir: dirname(database.path) }); service = createArtworkService(database.client); });
afterEach(async () => { await database.close(); });
async function png(name = "../../unsafe.png") { return new File([new Uint8Array(await sharp({ create: { width: 20, height: 30, channels: 4, background: { r: 220, g: 20, b: 40, alpha: 0.5 } } }).png().toBuffer())], name, { type: "image/png" }); }
it("front_replace_preserves_back and stored PNG survives a reopened asset service with transparency", async () => {
 const c = await seedCatalog(database.client), front = await store.storeImage(ctx, await png(), "artwork"), back = await store.storeImage(ctx, await png(), "artwork");
 const first = await service.replaceArtworkSide(ctx, c.artwork.id, 1, "back", back.id);
 await service.replaceArtworkSide(ctx, c.artwork.id, first.version, "front", front.id);
 expect(await database.client.artworkSet.findUnique({ where: { id: c.artwork.id } })).toMatchObject({ frontAssetId: front.id, backAssetId: back.id });
 const reopened = createAssetStore({ client: database.client, dataDir: dirname(database.path) });
 const bytes = (await reopened.readAsset(front.id)).bytes;
 expect((await sharp(bytes).metadata()).hasAlpha).toBe(true);
 expect((await sharp(bytes).raw().toBuffer())[3]).toBeGreaterThan(0);
 expect(front.url).toBe(`/api/assets/${front.id}`);
 const record = await database.client.asset.findUniqueOrThrow({ where: { id: front.id } });
 expect(record.storageKey).toMatch(/^[a-f0-9-]+\.png$/);
 expect(await readFile(join(dirname(database.path), "assets", record.storageKey))).toEqual(bytes);
});
it("fake_png_and_over_8mb_rejected; wrong artwork format rejected", async () => {
 await expect(store.storeImage(ctx, new File(["not an image"], "fake.png", { type: "image/png" }), "artwork")).rejects.toMatchObject({ status: 422 });
 await expect(store.storeImage(ctx, new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }), "artwork")).rejects.toMatchObject({ status: 422 });
 const jpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).jpeg().toBuffer();
 await expect(store.storeImage(ctx, new File([new Uint8Array(jpeg)], "fake.png", { type: "image/png" }), "artwork")).rejects.toMatchObject({ status: 422 });
 expect((await store.storeImage(ctx, new File([new Uint8Array(jpeg)], "blank.jpg", { type: "image/jpeg" }), "blank")).mime).toBe("image/jpeg");
});
it("decode_pixel_limit_rejected", async () => {
 const bytes = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: "white" } }).png().toBuffer();
 await expect(store.storeImage(ctx, new File([new Uint8Array(bytes)], "pixels.png", { type: "image/png" }), "artwork")).rejects.toMatchObject({ status: 422 });
});
it("write_failure_retains_previous_image and storage symlinks cannot escape the asset directory", async () => {
 const c = await seedCatalog(database.client), original = await store.storeImage(ctx, await png(), "artwork");
 await service.replaceArtworkSide(ctx, c.artwork.id, 1, "front", original.id);
 const failing = createAssetStore({ client: database.client, dataDir: dirname(database.path), promote: async () => { throw new Error("Disk full"); } });
 await expect(failing.storeImage(ctx, await png(), "artwork")).rejects.toMatchObject({ status: 503 });
 expect((await database.client.artworkSet.findUniqueOrThrow({ where: { id: c.artwork.id } })).frontAssetId).toBe(original.id);
 const nested = join(dirname(database.path), "nested"); await mkdir(nested); await symlink(dirname(database.path), join(nested, "assets"));
 await expect(createAssetStore({ client: database.client, dataDir: nested }).storeImage(ctx, await png(), "artwork")).rejects.toMatchObject({ status: 503 });
});
it("other_style_or_color_is_unchanged and color-specific placement/blank overrides shared then default", async () => {
 const c = await seedCatalog(database.client), other = await seedCatalog(database.client), asset = await store.storeImage(ctx, await png(), "blank");
 await service.setBlankPhoto(ctx, c.style.id, null, "front", asset.id);
 await service.savePlacement(ctx, c.style.id, c.artwork.id, "front", null, { x: 45, y: 40, width: 20, rotation: 5 });
 expect(await service.getCompositeSpec(c.style.id, c.artwork.id, c.color.id, "front")).toMatchObject({ blankUrl: asset.url, artworkUrl: null, placement: { x: 45, rotation: 5 } });
 await service.setBlankPhoto(ctx, c.style.id, c.color.id, "back", asset.id);
 await service.savePlacement(ctx, c.style.id, c.artwork.id, "front", c.color.id, { x: 60, y: 55, width: 30, rotation: 10 });
 expect((await service.getCompositeSpec(c.style.id, c.artwork.id, c.color.id, "front")).placement.x).toBe(60);
 expect(await service.getCompositeSpec(other.style.id, other.artwork.id, other.color.id, "front")).toMatchObject({ blankUrl: null, artworkUrl: null, placement: { x: 50, y: 47.7, width: 25, rotation: 0 } });
 expect((await service.getCompositeSpec(c.style.id, c.artwork.id, c.color.id, "back")).artworkUrl).toBeNull();
 await expect(service.setBlankPhoto(ctx, c.style.id, other.color.id, "front", asset.id)).rejects.toMatchObject({ status: 422 });
 await expect(service.savePlacement(ctx, c.style.id, other.artwork.id, "front", null, { x: 50, y: 50, width: 25, rotation: 0 })).rejects.toMatchObject({ status: 422 });
});
it("shared_asset_survives_copy_delete and last/ordered sets are protected", async () => {
 const c = await seedCatalog(database.client), asset = await store.storeImage(ctx, await png(), "artwork");
 await service.replaceArtworkSide(ctx, c.artwork.id, 1, "front", asset.id);
 await expect(service.deleteArtworkSet(ctx, c.artwork.id, 2)).rejects.toMatchObject({ code: "LAST_ARTWORK_SET" });
 const extra = await service.createArtworkSet(ctx, c.season.id, " Encore ");
 await database.client.order.create({ data: { seasonId: c.season.id, code: "ABC123", fullName: "Cancelled", cancelled: true, lines: { create: lineData(c) } } });
 await expect(service.deleteArtworkSet(ctx, c.artwork.id, 2)).rejects.toMatchObject({ code: "ARTWORK_IN_USE" });
 const copy = await createSeasonService(database.client).createSeason(ctx, { name: "Copy", opensOn: "2027-01-01", closesOn: "2027-01-31", announcement: "", copyFromSeasonId: c.season.id, reuseArtwork: true });
 await createSeasonService(database.client).deleteSeason(ctx, copy.id, 1);
 await service.deleteArtworkSet(ctx, extra.id, extra.version);
 expect((await store.readAsset(asset.id)).bytes.length).toBeGreaterThan(0);
});
it("deleting an unused sole-set association names and assigns the remaining set without deleting blank photos", async () => {
 const c = await seedCatalog(database.client), replacement = await service.createArtworkSet(ctx, c.season.id, "Replacement");
 const asset = await store.storeImage(ctx, await png(), "blank"); await service.setBlankPhoto(ctx, c.style.id, c.color.id, "front", asset.id);
 expect(await service.deleteArtworkSet(ctx, c.artwork.id, 1)).toEqual({ replacementSetId: replacement.id });
 expect(await database.client.styleArtworkSet.findFirst()).toMatchObject({ styleId: c.style.id, artworkSetId: replacement.id });
 expect(await database.client.blankPhoto.count()).toBe(1);
 await expect(service.createArtworkSet(ctx, c.season.id, " replacement ")).rejects.toMatchObject({ status: 422 });
});
it("published sets may have blank sides; versions and admin roles are enforced", async () => {
 const c = await seedCatalog(database.client), asset = await store.storeImage(ctx, await png(), "artwork");
 const front = await service.replaceArtworkSide(ctx, c.artwork.id, 1, "front", asset.id);
 await service.replaceArtworkSide(ctx, c.artwork.id, front.version, "back", asset.id);
 await createSeasonService(database.client).publishSeason(ctx, c.season.id, 3);
 await expect(service.replaceArtworkSide(ctx, c.artwork.id, 1, "front", asset.id)).rejects.toMatchObject({ code: "STALE_VERSION" });
 await expect(service.createArtworkSet({ ...ctx, actor: { ...ctx.actor, role: "member" } }, c.season.id, "Forbidden")).rejects.toMatchObject({ status: 403 });
 const replacement = await service.createArtworkSet(ctx, c.season.id, "Incomplete");
 await expect(service.deleteArtworkSet(ctx, c.artwork.id, 3)).resolves.toEqual({replacementSetId:replacement.id});
 expect(await database.client.artworkSet.count()).toBe(1);
 expect(replacement.frontAssetId).toBeNull();
});
it("deletion cannot silently use a different replacement than the named confirmation", async () => {
 const c = await seedCatalog(database.client);
 await service.createArtworkSet(ctx, c.season.id, "First replacement");
 const other = await service.createArtworkSet(ctx, c.season.id, "Different replacement");
 await expect(service.deleteArtworkSet(ctx, c.artwork.id, 1, other.id)).rejects.toMatchObject({ code: "STALE_VERSION" });
 expect(await database.client.artworkSet.findUnique({ where: { id: c.artwork.id } })).not.toBeNull();
});

it("placement editor reads shared/override versions per side and rejects stale scoped saves", async () => {
 const c = await seedCatalog(database.client);
 await service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,{x:40,y:40,width:20,rotation:10});
 await service.savePlacement(ctx,c.style.id,c.artwork.id,"front",c.color.id,{x:60,y:60,width:30,rotation:-10});
 const editor=await service.getPlacementEditor(ctx,c.style.id,c.artwork.id,c.color.id,"front");
 expect(editor).toMatchObject({spec:{placement:{x:60}},shared:{version:1,values:{x:40}},override:{version:1,values:{x:60}}});
 expect(await service.getPlacementEditor(ctx,c.style.id,c.artwork.id,c.color.id,"back")).toMatchObject({shared:null,override:null,spec:{placement:{x:50,y:47.7}}});
 await expect(service.getPlacementEditor({...ctx,actor:{...ctx.actor,role:"member"}},c.style.id,c.artwork.id,c.color.id,"front")).rejects.toMatchObject({status:403});
 await service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,{x:45,y:40,width:20,rotation:10},1);
 await expect(service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,{x:90,y:40,width:20,rotation:10},1)).rejects.toMatchObject({code:"STALE_VERSION",status:409});
 await expect(service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,{x:90,y:40,width:20,rotation:10},null)).rejects.toMatchObject({code:"STALE_VERSION",status:409});
 expect((await service.getPlacementEditor(ctx,c.style.id,c.artwork.id,c.color.id,"front")).shared?.values.x).toBe(45);
});
it("stale placement writes leave the last saved scoped geometry intact", async () => {
 const c = await seedCatalog(database.client), values={x:40,y:40,width:20,rotation:0};
 await service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,values);
 await expect(service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,{...values,x:90},99)).rejects.toMatchObject({code:"STALE_VERSION",status:409});
 expect((await service.getCompositeSpec(c.style.id,c.artwork.id,c.color.id,"front")).placement.x).toBe(40);
});
it("clears either artwork side without deleting the set, placements, other side or published availability",async()=>{
 const c=await seedCatalog(database.client), asset=await store.storeImage(ctx,await png(),"artwork");
 const withFront=await service.replaceArtworkSide(ctx,c.artwork.id,1,"front",asset.id);
 const both=await service.replaceArtworkSide(ctx,c.artwork.id,withFront.version,"back",asset.id);
 await service.savePlacement(ctx,c.style.id,c.artwork.id,"front",null,{x:50,y:50,width:30,rotation:0});
 await database.client.season.update({where:{id:c.season.id},data:{lifecycle:"PUBLISHED"}});
 const frontCleared=await service.removeArtworkSide(ctx,c.artwork.id,both.version,"front");
 expect(frontCleared).toMatchObject({frontAssetId:null,backAssetId:asset.id,version:both.version+1});
 await expect(service.removeArtworkSide(ctx,c.artwork.id,both.version,"back")).rejects.toMatchObject({status:409});
 await expect(service.removeArtworkSide({...ctx,actor:{...ctx.actor,role:"member"}},c.artwork.id,frontCleared.version,"back")).rejects.toMatchObject({status:403});
 const empty=await service.removeArtworkSide(ctx,c.artwork.id,frontCleared.version,"back");
 expect(empty).toMatchObject({frontAssetId:null,backAssetId:null});
 expect(await database.client.placement.count()).toBe(1);expect(await database.client.asset.count()).toBe(1);
 expect((await database.client.season.findUniqueOrThrow({where:{id:c.season.id}})).lifecycle).toBe("PUBLISHED");
 expect((await service.getCompositeSpec(c.style.id,c.artwork.id,c.color.id,"front")).artworkUrl).toBeNull();
});
