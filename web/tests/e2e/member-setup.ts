import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import credentials from "../fixtures/credentials.json" with { type: "json" };
export async function memberFixture(request: APIRequestContext) {
 const origin = "http://127.0.0.1:3100";
 const auth = await request.post("/api/auth/login", { headers: { Origin: origin }, data: { username: "admin", password: credentials.adminPassword } });
 const headers = { Origin: origin, "X-CSRF-Token": (await auth.json()).data.csrfToken };
 const seasons = (await (await request.get("/api/admin/seasons")).json()).data;
 for (const [index, s] of seasons.entries()) if (s.lifecycle === "PUBLISHED") {
  const year = 1800 + index;
  const response = await request.patch(`/api/admin/seasons/${s.id}`, { headers, data: { expectedVersion: s.version, name: s.name, opensOn: `${year}-01-01`, closesOn: `${year}-01-01`, announcement: s.announcement } }); expect(response.status()).toBe(200);
 }
 const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
 const created = await request.post("/api/admin/seasons", { headers, data: { name: `Member UI ${randomUUID().slice(0,8)}`, opensOn: today, closesOn: today, announcement: "Pick up at rehearsal.", copyFromSeasonId: seasons.find((s: { name: string }) => s.name === "First season").id, reuseArtwork: false } }); expect(created.status()).toBe(200);
 const season = (await created.json()).data, catalog = (await (await request.get(`/api/admin/seasons/${season.id}/catalog`)).json()).data;
 const set = catalog.artworkSets[0], style = catalog.styles[0];
 let version = set.version;
 for (const side of ["front", "back"]) {
  const png = await sharp({ create: { width: 40, height: 60, channels: 4, background: side === "front" ? "white" : "black" } }).png().toBuffer();
  const response = await request.post(`/api/admin/artwork-sets/${set.id}/${side}`, { headers, multipart: { file: { name: `${side}.png`, mimeType: "image/png", buffer: png }, expectedVersion: String(version) } }); expect(response.status()).toBe(200); version = (await response.json()).data.version;
 }
 const latest = (await (await request.get("/api/admin/seasons")).json()).data.find((s: { id: string }) => s.id === season.id);
 expect((await request.post(`/api/admin/seasons/${season.id}/publish`, { headers, data: { expectedVersion: latest.version } })).status()).toBe(200);
 return { season, style, set, headers };
}
export async function memberLogin(page: Page) {
 await page.goto("/login"); await page.getByLabel("Username", { exact: true }).fill("user"); await page.getByLabel("Password", { exact: true }).fill(credentials.memberPassword); await page.getByRole("button", { name: /Sign in/ }).click(); await expect(page).toHaveURL(/\/shop$/);
}
export async function addShirt(page: Page, quantity = "1") {
 const card = page.getByRole("article").first(); await card.getByRole("combobox", { name: "Size" }).selectOption({ label: "L" }); await card.getByRole("spinbutton", { name: "Qty" }).fill(quantity); await card.getByRole("button", { name: "Add +", exact: true }).click();
}
