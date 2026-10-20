import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase, seedCatalog, lineData } from "../fixtures/database";
import { createMemberData } from "../../src/features/orders/member-data";
import { createOrderService } from "../../src/features/orders/service";
import type { RequestContext } from "../../src/domain/types";
let database: Awaited<ReturnType<typeof testDatabase>>, ctx: RequestContext, data: ReturnType<typeof createMemberData>, catalog: Awaited<ReturnType<typeof seedCatalog>>;
beforeEach(async () => { database = await testDatabase(); catalog = await seedCatalog(database.client); ctx = { actor: { role: "member", sessionId: randomUUID() }, now: new Date("2026-10-14T12:00:00Z") }; data = createMemberData(database.client); });
afterEach(async () => { vi.unstubAllEnvs(); await database.close(); });
it("offers email only when explicitly enabled and fully configured, exposing no credentials", async () => {
 vi.stubEnv("ORDER_CONFIRMATION_EMAILS_ENABLED", "false");
 expect((await data.shop(ctx)).confirmationEmailsEnabled).toBe(false);
 vi.stubEnv("ORDER_CONFIRMATION_EMAILS_ENABLED", "true");
 vi.stubEnv("RESEND_API_KEY", "re_private_key"); vi.stubEnv("RESEND_FROM_EMAIL", "orders@example.com");
 const shop = await data.shop(ctx);
 expect(shop.confirmationEmailsEnabled).toBe(true);
 expect(JSON.stringify(shop)).not.toContain("re_private_key");
 vi.stubEnv("RESEND_FROM_EMAIL", "invalid");
 expect((await data.shop(ctx)).confirmationEmailsEnabled).toBe(false);
});
it("hides drafts from members, selects open published collection, and gates admin preview even when open", async () => {
 expect((await data.shop(ctx)).season).toBeNull();
 await expect(data.shop(ctx, catalog.season.id)).rejects.toMatchObject({ status: 403 });
 const preview = await data.shop({ ...ctx, actor: { ...ctx.actor, role: "admin" } }, catalog.season.id);
 expect(preview).toMatchObject({ open: false, preview: true, status: "Draft" });
 await database.client.season.update({ where: { id: catalog.season.id }, data: { lifecycle: "PUBLISHED" } });
 expect(await data.shop(ctx)).toMatchObject({ open: true, preview: false, season: { id: catalog.season.id }, styles: [{ colors: [{ hex: "#1247ED" }] }] });
 expect((await data.shop({ ...ctx, now: new Date("2026-11-02") })).open).toBe(false);
});
it("lookup presentation preserves ordered swatch and removed set association and derives member edit gate", async () => {
 await database.client.season.update({ where: { id: catalog.season.id }, data: { lifecycle: "PUBLISHED" } });
 const record = await database.client.order.create({ data: { seasonId: catalog.season.id, code: "BR4SS2", fullName: "Member", lines: { create: lineData(catalog) } } });
 const session = await database.client.session.create({ data: { tokenHash: randomUUID(), csrfTokenHash: "a".repeat(64), role: "member", expiresAt: new Date("2030-01-01") } }); ctx.actor.sessionId = session.id;
 const order = await createOrderService(database.client).lookupOrder(ctx, record.code);
 await database.client.styleColor.update({ where: { id: catalog.color.id }, data: { hex: "#000000", name: "New" } });
 await database.client.styleArtworkSet.deleteMany({ where: { styleId: catalog.style.id } });
 const shown = await data.present(ctx, order);
 expect(shown.canEdit).toBe(true); expect(shown.previews[order.lines[0].id].front.color).toBe("#1247ED"); expect(shown.previews[order.lines[0].id].back.artworkUrl).toBeNull();
 expect((await data.present({ ...ctx, now: new Date("2026-11-02") }, order)).canEdit).toBe(false);
 expect((await data.present(ctx, { ...order, progress: "DELIVERED_UNPAID" })).canEdit).toBe(false);
});

it("includes manufacturer links in the member catalog", async () => {
 await database.client.merchandiseStyle.update({ where: { id: catalog.style.id }, data: { manufacturerUrl: "https://example.com/tee" } });
 await database.client.season.update({ where: { id: catalog.season.id }, data: { lifecycle: "PUBLISHED" } });
 expect((await data.shop(ctx)).styles[0]).toMatchObject({ manufacturerUrl: "https://example.com/tee" });
});
it("offers back previews only for colors with an actual back shirt photo, including shared fallback",async()=>{
 const other=await database.client.styleColor.create({data:{styleId:catalog.style.id,name:"Black",normalizedName:"black",hex:"#000000",position:1}});
 const asset=await database.client.asset.create({data:{mime:"image/png",width:40,height:60,byteSize:1024,storageKey:randomUUID(),sha256:"a".repeat(64)}});
 await database.client.artworkSet.update({where:{id:catalog.artwork.id},data:{backAssetId:asset.id}});
 const actor={...ctx,actor:{...ctx.actor,role:"admin" as const}};
 const read=async()=> (await data.shop(actor,catalog.season.id)).styles[0].backPhotoColorIds;
 expect(await read()).toEqual([]);
 await database.client.blankPhoto.create({data:{styleId:catalog.style.id,colorId:catalog.color.id,scopeKey:catalog.color.id,side:"front",assetId:asset.id}});
 expect(await read()).toEqual([]);
 await database.client.blankPhoto.create({data:{styleId:catalog.style.id,colorId:other.id,scopeKey:other.id,side:"back",assetId:asset.id}});
 expect(await read()).toEqual([other.id]);
 await database.client.blankPhoto.create({data:{styleId:catalog.style.id,scopeKey:"all",side:"back",assetId:asset.id}});
 expect(await read()).toEqual([catalog.color.id,other.id]);
});
