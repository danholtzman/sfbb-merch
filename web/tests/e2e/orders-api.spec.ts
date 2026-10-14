import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import credentials from "../fixtures/credentials.json" with { type: "json" };
test("order APIs enforce prices, replay, preview, member edit gates, and admin corrections", { tag: "@orders-api" }, async ({ request }) => {
 const origin = "http://127.0.0.1:3100";
 const login = async (username: string, password: string) => { const response = await request.post("/api/auth/login", { headers: { Origin: origin }, data: { username, password } }); expect(response.status()).toBe(200); return { Origin: origin, "X-CSRF-Token": (await response.json()).data.csrfToken }; };
 let headers = await login("admin", credentials.adminPassword);
 const first = (await (await request.get("/api/admin/seasons")).json()).data[0];
 const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
 const created = await request.post("/api/admin/seasons", { headers, data: { name: `Order API ${randomUUID()}`, opensOn: today, closesOn: today, announcement: "", copyFromSeasonId: first.id, reuseArtwork: false } }); expect(created.status()).toBe(200);
 const season = (await created.json()).data, catalog = (await (await request.get(`/api/admin/seasons/${season.id}/catalog`)).json()).data;
 const set = catalog.artworkSets[0], style = catalog.styles[0];
 const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: "white" } }).png().toBuffer();
 let version = set.version;
 for (const side of ["front", "back"]) { const response = await request.post(`/api/admin/artwork-sets/${set.id}/${side}`, { headers, multipart: { file: { name: `${side}.png`, mimeType: "image/png", buffer: png }, expectedVersion: String(version) } }); expect(response.status()).toBe(200); version = (await response.json()).data.version; }
 const current = (await (await request.get("/api/admin/seasons")).json()).data.find((s: { id: string }) => s.id === season.id);
 expect((await request.post(`/api/admin/seasons/${season.id}/publish`, { headers, data: { expectedVersion: current.version } })).status()).toBe(200);
 headers = await login("user", credentials.memberPassword);
 const payload = { seasonId: season.id, fullName: "API Member", note: "", lines: [{ styleId: style.id, artworkSetId: set.id, colorId: style.colors[0].id, sizeId: style.sizes[0].id, quantity: 2 }] }, key = randomUUID();
 expect((await request.post("/api/orders", { data: payload })).status()).toBe(403);
 expect((await request.post("/api/orders", { headers: { ...headers, "Idempotency-Key": key, "X-SFBB-Preview": "1" }, data: payload })).status()).toBe(403);
 const post = () => request.post("/api/orders", { headers: { ...headers, "Idempotency-Key": key }, data: payload });
 const [a,b] = await Promise.all([post(),post()]); expect(a.status()).toBe(200); expect(b.status()).toBe(200);
 const order = (await a.json()).data; expect((await b.json()).data.id).toBe(order.id); expect(order.amountOwedCents).toBe(style.unitPriceCents*2);
 expect((await request.post("/api/orders", { headers: { ...headers, "Idempotency-Key": key }, data: { ...payload, fullName: "Different" } })).status()).toBe(409);
 const lookup = await request.post("/api/orders/lookup", { headers, data: { code: order.code.toLowerCase() } }); expect(lookup.status()).toBe(200);
 const editPayload = { expectedVersion: 1, fullName: "API Revised", note: "", lines: [{ ...payload.lines[0], originalLineId: order.lines[0].id, quantity: 3 }] };
 expect((await request.patch(`/api/orders/${order.code}`, { headers, data: editPayload })).status()).toBe(200);
 expect((await request.patch(`/api/orders/${order.code}`, { headers, data: editPayload })).status()).toBe(409);
 expect((await request.get(`/api/admin/orders?seasonId=${season.id}`, { headers: { "X-Role": "admin" } })).status()).toBe(403);
 headers = await login("admin", credentials.adminPassword);
 let response = await request.patch(`/api/admin/orders/${order.id}/progress`, { headers, data: { expectedVersion: 2, progress: "DELIVERED_UNPAID" } }); expect(response.status()).toBe(200); let updated = (await response.json()).data;
 response = await request.post(`/api/admin/orders/${order.id}/cancel`, { headers, data: { expectedVersion: updated.version } }); expect(response.status()).toBe(200); updated = (await response.json()).data; expect(updated.amountOwedCents).toBe(0);
 response = await request.post(`/api/admin/orders/${order.id}/restore`, { headers, data: { expectedVersion: updated.version } }); expect(response.status()).toBe(200); updated = (await response.json()).data; expect(updated.progress).toBe("DELIVERED_UNPAID");
 headers = await login("user", credentials.memberPassword);
 expect((await request.post(`/api/orders/${order.code}/cancel`, { headers, data: { expectedVersion: updated.version } })).status()).toBe(409);
 // Keep historical test orders in their isolated season, but close its published window
 // so the second browser project can run the same acceptance scenario without overlap.
 headers = await login("admin", credentials.adminPassword);
 const summary = (await (await request.get("/api/admin/seasons")).json()).data.find((s: { id: string }) => s.id === season.id);
 const year = 2000 + (test.info().project.name === "mobile" ? 1 : 0);
 expect((await request.patch(`/api/admin/seasons/${season.id}`, { headers, data: { expectedVersion: summary.version, name: summary.name, opensOn: `${year}-01-01`, closesOn: `${year}-01-01`, announcement: "" } })).status()).toBe(200);
});
