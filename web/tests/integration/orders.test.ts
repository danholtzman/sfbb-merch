import { beforeEach, afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase, seedCatalog } from "../fixtures/database";
import { createOrderService } from "../../src/features/orders/service";
import type { RequestContext } from "../../src/domain/types";
let database: Awaited<ReturnType<typeof testDatabase>>, service: ReturnType<typeof createOrderService>, catalog: Awaited<ReturnType<typeof seedCatalog>>, member: RequestContext, admin: RequestContext;
beforeEach(async () => {
 database = await testDatabase(); catalog = await seedCatalog(database.client);
 const asset = await database.client.asset.create({ data: { mime: "image/png", width: 30, height: 40, byteSize: 100, storageKey: randomUUID()+".png", sha256: "a".repeat(64) } });
 await database.client.artworkSet.update({ where: { id: catalog.artwork.id }, data: { frontAssetId: asset.id, backAssetId: asset.id } });
 await database.client.season.update({ where: { id: catalog.season.id }, data: { lifecycle: "PUBLISHED" } });
 const now = new Date("2026-10-14T12:00:00Z");
 const session = async (role: "member" | "admin") => ({ actor: { role, sessionId: (await database.client.session.create({ data: { tokenHash: randomUUID(), csrfTokenHash: "a".repeat(64), role, expiresAt: new Date("2030-01-01") } })).id }, now });
 member = await session("member"); admin = await session("admin"); service = createOrderService(database.client);
});
afterEach(async () => { await database.close(); });
const line = () => ({ styleId: catalog.style.id, artworkSetId: catalog.artwork.id, colorId: catalog.color.id, sizeId: catalog.size.id, quantity: 2 });
const input = () => ({ seasonId: catalog.season.id, fullName: "  Alex Morgan  ", note: " Rehearsal pickup ", lines: [line()] });
const submit = () => service.submitOrder(member, input(), randomUUID());
it("merges identical variants and computes integer-cent server prices with trimmed name/note", async () => {
 const result = await service.submitOrder(member, { ...input(), lines: [line(), { ...line(), quantity: 1 }] }, randomUUID());
 expect(result).toMatchObject({ fullName: "Alex Morgan", note: "Rehearsal pickup", amountOwedCents: 7530, progress: "OPEN", cancelled: false, version: 1 });
 expect(result.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
 expect(result.lines).toHaveLength(1); expect(result.lines[0]).toMatchObject({ quantity: 3, unitPriceCents: 2510, colorName: "Blue", colorHex: "#1247ED" });
});
it("rejects malformed quantities, empty lines, oversized names/notes, client prices, cross-season and unavailable variants", async () => {
 const other = await seedCatalog(database.client);
 for (const bad of [{ ...input(), lines: [] }, { ...input(), fullName: " " }, { ...input(), fullName: "x".repeat(101) }, { ...input(), note: "x".repeat(2001) }, { ...input(), lines: [{ ...line(), quantity: 0 }] }, { ...input(), lines: [{ ...line(), quantity: 1.5 }] }, { ...input(), lines: [{ ...line(), unitPriceCents: 0 }] }, { ...input(), lines: [{ ...line(), colorId: other.color.id }] }, { ...input(), lines: [{ ...line(), artworkSetId: other.artwork.id }] }]) await expect(service.submitOrder(member, bad, randomUUID())).rejects.toMatchObject({ status: 422 });
 expect(await database.client.order.count()).toBe(0);
 const withoutNote = { seasonId: catalog.season.id, fullName: "Member", lines: [line()] };
 expect((await service.submitOrder(member, withoutNote, randomUUID())).note).toBe("");
});
it("one order survives concurrent duplicate checkout; normalized retries replay and changed payload conflicts", async () => {
 const key = randomUUID();
 const [a,b] = await Promise.all([service.submitOrder(member, input(), key), service.submitOrder(member, input(), key)]);
 expect(a.id).toBe(b.id); expect(await database.client.order.count()).toBe(1);
 expect((await service.submitOrder(member, { ...input(), fullName: "Alex Morgan", lines: [{ ...line(), quantity: 1 }, { ...line(), quantity: 1 }] }, key)).id).toBe(a.id);
 await expect(service.submitOrder(member, { ...input(), note: "Changed" }, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
 expect((await service.submitOrder(admin, input(), key)).id).not.toBe(a.id);
});
it("retries cryptographic-code collisions and aborts exhausted retries without partial orders", async () => {
 const first = await createOrderService(database.client, { generateCode: () => "ABC234" }).submitOrder(member, input(), randomUUID());
 let count = 0; const second = await createOrderService(database.client, { generateCode: () => ++count < 3 ? first.code : "DEF567" }).submitOrder(member, input(), randomUUID());
 expect(second.code).toBe("DEF567"); expect(count).toBe(3);
 await expect(createOrderService(database.client, { generateCode: () => first.code }).submitOrder(member, input(), randomUUID())).rejects.toMatchObject({ code: "CODE_UNAVAILABLE" });
 expect(await database.client.order.count()).toBe(2);
});
it("checks published LA windows inside the transaction, including exact spring/fall DST midnight", async () => {
 await database.client.season.update({ where: { id: catalog.season.id }, data: { opensOn: "2026-11-01", closesOn: "2026-11-01" } });
 for (const date of ["2026-11-01T06:59:59Z", "2026-11-02T08:00:00Z"]) await expect(service.submitOrder({ ...member, now: new Date(date) }, input(), randomUUID())).rejects.toMatchObject({ code: "ORDERING_CLOSED" });
 expect((await service.submitOrder({ ...member, now: new Date("2026-11-02T07:59:59Z") }, input(), randomUUID())).id).toBeTruthy();
 await database.client.season.update({ where: { id: catalog.season.id }, data: { opensOn: "2027-03-14", closesOn: "2027-03-14" } });
 expect((await service.submitOrder({ ...member, now: new Date("2027-03-14T08:00:00Z") }, input(), randomUUID())).id).toBeTruthy();
 await expect(createOrderService(database.client, { now: () => new Date("2027-03-15T07:00:00Z") }).submitOrder({ ...member, now: new Date("2027-03-14T08:00:00Z") }, input(), randomUUID())).rejects.toMatchObject({ code: "ORDERING_CLOSED" });
});
it("rejects draft/archived/preview creation, while identical retries after closing return the original order", async () => {
 const key = randomUUID(), first = await service.submitOrder(member, input(), key);
 await expect(service.submitOrder({ ...admin, preview: true }, input(), randomUUID())).rejects.toMatchObject({ code: "PREVIEW_ONLY" });
 for (const lifecycle of ["DRAFT", "ARCHIVED"] as const) {
  await database.client.season.update({ where: { id: catalog.season.id }, data: { lifecycle } });
  await expect(service.submitOrder(admin, input(), randomUUID())).rejects.toMatchObject({ code: "ORDERING_CLOSED" });
 }
 expect((await service.submitOrder(member, input(), key)).id).toBe(first.id);
});
it("member edits preserve historical prices/colors while new lines use the changed current catalog", async () => {
 const first = await submit();
 await database.client.merchandiseStyle.update({ where: { id: catalog.style.id }, data: { unitPriceCents: 3200 } });
 await database.client.styleColor.update({ where: { id: catalog.color.id }, data: { name: "Midnight", hex: "#000001" } });
 const edited = await service.editMemberOrder(member, first.code, first.version, { fullName: "Alex revised", note: "", lines: [{ ...line(), originalLineId: first.lines[0].id, quantity: 3 }, { ...line(), quantity: 1 }] });
 expect(edited.code).toBe(first.code); expect(edited.amountOwedCents).toBe(10730); expect(edited.lines).toHaveLength(2);
 expect(edited.lines[0]).toMatchObject({ id: first.lines[0].id, unitPriceCents: 2510, colorName: "Blue", colorHex: "#1247ED" });
 expect(edited.lines[1]).toMatchObject({ unitPriceCents: 3200, colorName: "Midnight", colorHex: "#000001" });
});
it("simultaneous edits fail stale without overwriting; foreign original line IDs and duplicate IDs are rejected", async () => {
 const first = await submit(), second = await submit();
 const edit = { fullName: "Changed", note: "", lines: [{ ...line(), originalLineId: first.lines[0].id }] };
 const results = await Promise.allSettled([service.editMemberOrder(member, first.code, 1, edit), service.editMemberOrder(member, first.code, 1, edit)]);
 expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "STALE_VERSION" } });
 await expect(service.editMemberOrder(member, second.code, 1, edit)).rejects.toMatchObject({ status: 422 });
 await expect(service.editMemberOrder(member, first.code, 2, { ...edit, lines: [edit.lines[0], edit.lines[0]] })).rejects.toMatchObject({ status: 422 });
});
it("member edits/cancel/restore require open window and OPEN progress; cancelled Open can be restored", async () => {
 const first = await submit(), cancelled = await service.cancelOrder(member, first.code, 1);
 expect(cancelled.amountOwedCents).toBe(0); expect(cancelled.lines).toEqual(first.lines);
 const restored = await service.restoreOrder(member, first.code, cancelled.version); expect(restored.progress).toBe("OPEN"); expect(restored.amountOwedCents).toBe(5020);
 const delivered = await service.setOrderProgress(admin, first.id, restored.version, "DELIVERED_UNPAID");
 for (const operation of [() => service.cancelOrder(member, first.code, delivered.version), () => service.editMemberOrder(member, first.code, delivered.version, { fullName: "No", note: "", lines: [line()] })]) await expect(operation()).rejects.toMatchObject({ code: "ORDER_LOCKED" });
 const closed = { ...member, now: new Date("2026-11-01T08:00:00Z") };
 await expect(service.restoreOrder(closed, first.code, delivered.version)).rejects.toMatchObject({ code: "ORDER_LOCKED" });
});
it("admins edit closed/Complete orders with explicit prices and restore retained progress; corrections go both directions", async () => {
 const first = await submit(); const complete = await service.setOrderProgress(admin, first.id, 1, "COMPLETE"); expect(complete.amountOwedCents).toBe(0);
 await database.client.styleColor.update({ where: { id: catalog.color.id }, data: { name: "Renamed", hex: "#000000" } });
 const closedAdmin = { ...admin, now: new Date("2026-11-01T08:00:00Z") };
 const edited = await service.editAdminOrder(closedAdmin, first.id, complete.version, { fullName: "Admin revised", note: "", lines: [{ ...line(), originalLineId: first.lines[0].id, unitPriceCents: 0 }] });
 expect(edited).toMatchObject({ code: first.code, progress: "COMPLETE", cancelled: false }); expect(edited.lines[0]).toMatchObject({ colorName: "Blue", colorHex: "#1247ED", unitPriceCents: 0 });
 const cancelled = await service.cancelOrder(closedAdmin, first.id, edited.version), restored = await service.restoreOrder(closedAdmin, first.id, cancelled.version); expect(restored.progress).toBe("COMPLETE");
 const reopened = await service.setOrderProgress(closedAdmin, first.id, restored.version, "OPEN"); expect(reopened.progress).toBe("OPEN");
 await expect(service.editAdminOrder(member, first.id, reopened.version, { fullName: "No", lines: [{ ...line(), unitPriceCents: 0 }] })).rejects.toMatchObject({ status: 403 });
});
it("lookup normalizes valid codes, commits failed-attempt limits per session/address, and remains usable after close", async () => {
 const first = await submit(); expect((await service.lookupOrder({ ...member, now: new Date("2026-11-10") }, ` ${first.code.toLowerCase()} `)).id).toBe(first.id);
 const limited = createOrderService(database.client, { address: "127.0.0.1" });
 for (let i=0;i<10;i++) await expect(limited.lookupOrder(member, i % 2 ? "ZZZ999" : "bad!")).rejects.toMatchObject({ code: "ORDER_NOT_FOUND", status: 404 });
 await expect(limited.lookupOrder(member, first.code)).rejects.toMatchObject({ status: 429 });
 expect((await limited.lookupOrder({ ...member, now: new Date(member.now.getTime()+15*60*1000) }, first.code)).id).toBe(first.id);
 expect((await limited.lookupOrder(admin, first.code)).id).toBe(first.id);
});
it("rejects unsafe total arithmetic and stale/revoked sessions without persisting an order", async () => {
 await database.client.merchandiseStyle.update({ where: { id: catalog.style.id }, data: { unitPriceCents: 2147483647 } });
 await expect(service.submitOrder(member, { ...input(), lines: [{ ...line(), quantity: 2147483647 }] }, randomUUID())).rejects.toMatchObject({ status: 422 });
 await database.client.session.delete({ where: { id: member.actor.sessionId } });
 await expect(service.submitOrder(member, input(), randomUUID())).rejects.toMatchObject({ status: 401 }); expect(await database.client.order.count()).toBe(0);
});
it("failed member mutation code guesses share the lookup limit", async () => {
 const first = await submit();
 for (let i=0;i<10;i++) await expect(service.cancelOrder(member, "ZZZ999", 1)).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
 await expect(service.lookupOrder(member, first.code)).rejects.toMatchObject({ code: "LOOKUP_THROTTLED" });
});

it("checkout catalog version rejects a price race before creating an order, but permits cached replay", async () => {
 const payload = input(), key = randomUUID();
 await expect(service.submitOrder({ ...member, expectedCatalogVersion: 99 }, payload, key)).rejects.toMatchObject({ code: "CATALOG_CHANGED", status: 409 });
 expect(await database.client.order.count()).toBe(0);
 const order = await service.submitOrder({ ...member, expectedCatalogVersion: 1 }, payload, key);
 await database.client.season.update({ where: { id: catalog.season.id }, data: { version: { increment: 1 } } });
 expect((await service.submitOrder({ ...member, expectedCatalogVersion: 1 }, payload, key)).id).toBe(order.id);
});
