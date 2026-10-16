import { test, expect } from "@playwright/test";
import { memberFixture, memberLogin, addShirt } from "./member-setup";
test.describe("member ordering", { tag: "@member-ui" }, () => {
 test("optional email submits with checkout while the disabled service still completes the order", async ({ page, request }) => {
  await memberFixture(request); await memberLogin(page); await addShirt(page);
  // Exercise the enabled form without sending external mail from the test server.
  await page.route("**/api/member/catalog", async route => {
   const response = await route.fetch(), body = await response.json();
   await route.fulfill({ response, json: { ...body, data: { ...body.data, confirmationEmailsEnabled: true } } });
  });
  await page.getByRole("button", { name: /Bag 1/ }).click(); await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Email Member");
  await page.getByLabel("Confirmation email (optional)", { exact: true }).fill("member@example.com");
  let lost = false;
  await page.route("**/api/orders", async route => {
   if (route.request().method() === "POST" && !lost) { lost = true; await route.fetch(); await route.abort("failed"); }
   else await route.continue();
  });
  const submitted = page.waitForRequest(req => req.url().endsWith("/api/orders") && req.method() === "POST");
  await page.getByRole("button", { name: "Place order" }).click();
  expect((await submitted).postDataJSON().confirmationEmail).toBe("member@example.com");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("try again");
  expect(await page.evaluate(() => sessionStorage.getItem("sfbb:cart"))).not.toContain("member@example.com");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByTestId("order-code")).toBeVisible();
 });
 test("single-set checkout, copy, lookup, edit, cancel and restore preserve one order", async ({ page, request }, info) => {
  const fixture = await memberFixture(request); await memberLogin(page);
  const card = page.getByRole("article").first(); await expect(card.getByRole("combobox", { name: "Artwork set" })).toHaveCount(0);
  await card.getByRole("button", { name: "Add +", exact: true }).click(); await expect(card.getByRole("alert")).toContainText("size");
  await addShirt(page, "2"); await addShirt(page);
  await page.getByRole("button", { name: /Bag 3/ }).click(); const bag = page.getByRole("dialog", { name: "Your bag" }); await expect(bag).toBeVisible(); await expect(bag.getByText("$75.00", { exact: true })).toBeVisible();
  await bag.getByRole("button", { name: "Continue to checkout" }).click(); const checkout = page.getByRole("dialog", { name: "Checkout" }); await checkout.getByLabel("Full name", { exact: true }).fill("Browser Member"); await checkout.getByLabel("Member note", { exact: true }).fill("Thanks!");
  await checkout.getByRole("button", { name: "Place order" }).click(); const confirmation = page.getByRole("dialog", { name: "You're on the list." }); await expect(confirmation).toBeVisible();
  const code = await confirmation.getByTestId("order-code").innerText(); expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as unknown as { copied: string }).copied = value; } } }); });
  await confirmation.getByRole("button", { name: "Copy order code" }).click(); expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(code);
  await page.screenshot({ path: info.outputPath("confirmation.png"), fullPage: true }); await confirmation.getByRole("button", { name: "Return to shop" }).click();
  await page.getByRole("link", { name: "Find my order" }).click(); const lookup = page.getByRole("dialog", { name: "Find my order" }); await lookup.getByLabel("Order code", { exact: true }).fill(code.toLowerCase()); await lookup.getByRole("button", { name: "Look up order" }).click();
  const details = page.getByRole("dialog", { name: "Browser Member’s order" }); await expect(details).toBeVisible(); await expect(details.getByText(fixture.season.name, { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Edit order", exact: true }).click(); await expect(page).toHaveURL(/\/shop$/); await expect(page.getByRole("dialog", { name: "Your bag" })).toBeVisible();
  await page.getByRole("dialog").getByRole("spinbutton", { name: /Quantity for/ }).fill("4"); await page.getByRole("dialog").getByRole("button", { name: "Continue to checkout" }).click(); await page.getByRole("dialog").getByLabel("Full name", { exact: true }).fill("Revised Member"); await page.getByRole("button", { name: "Save order changes" }).click(); await expect(page.getByTestId("order-code")).toHaveText(code);
  await page.getByRole("button", { name: "Return to shop" }).click(); await page.getByRole("link", { name: "Find my order" }).click(); await page.getByLabel("Order code", { exact: true }).fill(code); await page.getByRole("button", { name: "Look up order" }).click();
  await page.getByRole("button", { name: "Cancel order", exact: true }).click(); await page.getByRole("button", { name: `Yes, cancel order ${code}` }).click(); await expect(page.getByRole("dialog").getByText("Cancelled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore order", exact: true }).click(); await expect(page.getByRole("dialog").getByText("Open", { exact: true })).toBeVisible();
  const orders = (await (await request.get(`/api/admin/orders?seasonId=${fixture.season.id}`)).json()).data; expect(orders).toHaveLength(1); expect(orders[0]).toMatchObject({ code, fullName: "Revised Member", amountOwedCents: 10000 });
 });
 test("catalog refresh changes bag prices before confirmation and stale edit keeps unsaved inputs", async ({ page, request }) => {
  const fixture = await memberFixture(request); await memberLogin(page); await addShirt(page);
  expect((await request.patch(`/api/admin/styles/${fixture.style.id}/price`, { headers: fixture.headers, data: { expectedVersion: fixture.style.version, unitPriceCents: 3200 } })).status()).toBe(200);
  await page.getByRole("button", { name: /Bag 1/ }).click(); await page.getByRole("button", { name: "Continue to checkout" }).click(); await expect(page.getByRole("dialog").getByRole("alert")).toContainText("changed"); await expect(page.getByRole("dialog").getByText("$32.00", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Continue to checkout" }).click(); await page.getByLabel("Full name", { exact: true }).fill("Stale Member"); await page.getByRole("button", { name: "Place order" }).click(); const code = await page.getByTestId("order-code").innerText(); await page.getByRole("button", { name: "Return to shop" }).click();
  await page.getByRole("link", { name: "Find my order" }).click(); await page.getByLabel("Order code", { exact: true }).fill(code); await page.getByRole("button", { name: "Look up order" }).click(); await page.getByRole("button", { name: "Edit order", exact: true }).click();
  const orders = (await (await request.get(`/api/admin/orders?seasonId=${fixture.season.id}`)).json()).data;
  expect((await request.patch(`/api/admin/orders/${orders[0].id}`, { headers: fixture.headers, data: { expectedVersion: orders[0].version, fullName: "Admin revision", note: "", lines: orders[0].lines.map((l: { id: string; styleId: string; artworkSetId: string; colorId: string; sizeId: string; quantity: number; unitPriceCents: number }) => ({ originalLineId: l.id, styleId: l.styleId, artworkSetId: l.artworkSetId, colorId: l.colorId, sizeId: l.sizeId, quantity: l.quantity, unitPriceCents: l.unitPriceCents })) } })).status()).toBe(200);
  await page.getByRole("button", { name: "Continue to checkout" }).click(); await page.getByLabel("Full name", { exact: true }).fill("My unsaved name"); await page.getByRole("button", { name: "Save order changes" }).click(); await expect(page.getByRole("dialog").getByRole("alert")).toContainText("changed"); await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("My unsaved name");
 });
});
test.describe("member safeguards", { tag: "@member-ui" }, () => {
 test("preview bag supports one set while checkout stays disabled", async ({ page, request }) => {
  const fixture = await memberFixture(request); const auth = await page.request.post("/api/auth/login", { headers: { Origin: "http://127.0.0.1:3100" }, data: { username: "admin", password: (await import("../fixtures/credentials.json", { with: { type: "json" } })).default.adminPassword } }); expect(auth.status()).toBe(200);
  await page.goto(`/shop?previewSeasonId=${fixture.season.id}`); await expect(page.getByText("Preview only — checkout unavailable", { exact: true })).toBeVisible(); await addShirt(page); await page.getByRole("button", { name: /Bag 1/ }).click(); await expect(page.getByRole("button", { name: "Continue to checkout" })).toBeDisabled();
 });
 test("fractional quantities, lookup errors, locked orders, session isolation, and lost-response retry", async ({ page, request }) => {
  const fixture = await memberFixture(request); await memberLogin(page); const card = page.getByRole("article").first(); await card.getByRole("combobox", { name: "Size" }).selectOption({ label: "L" }); await card.getByRole("spinbutton", { name: "Qty" }).fill("1.5"); await card.getByRole("button", { name: "Add +", exact: true }).click(); await expect(card.getByRole("alert")).toContainText("whole number");
  await addShirt(page); await page.reload(); await page.getByRole("button", { name: /Bag 1/ }).click(); await page.getByRole("button", { name: "Continue to checkout" }).click(); await page.getByLabel("Full name", { exact: true }).fill("Retry Member");
  let lost = false; await page.route("**/api/orders", async route => { if (route.request().method() === "POST" && !lost) { lost = true; await route.fetch(); await route.abort("failed"); } else await route.continue(); });
  await page.getByRole("button", { name: "Place order" }).click(); await expect(page.getByRole("dialog").getByRole("alert")).toContainText("try again"); await page.getByRole("button", { name: "Place order" }).click(); const code = await page.getByTestId("order-code").innerText();
  const orders = (await (await request.get(`/api/admin/orders?seasonId=${fixture.season.id}`)).json()).data; expect(orders).toHaveLength(1); await page.getByRole("button", { name: "Return to shop" }).click();
  expect((await request.patch(`/api/admin/orders/${orders[0].id}/progress`, { headers: fixture.headers, data: { expectedVersion: orders[0].version, progress: "DELIVERED_UNPAID" } })).status()).toBe(200);
  await page.getByRole("link", { name: "Find my order" }).click(); await page.getByLabel("Order code", { exact: true }).fill("ZZZ999"); await page.getByRole("button", { name: "Look up order" }).click(); await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not found");
  await page.getByLabel("Order code", { exact: true }).fill(code); await page.getByRole("button", { name: "Look up order" }).click(); await expect(page.getByRole("dialog").getByText("Delivered · unpaid", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Edit order", exact: true })).toHaveCount(0); await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Season shop" }).click(); await addShirt(page); const saved = await page.evaluate(() => sessionStorage.getItem("sfbb:cart")); await page.getByRole("button", { name: "Sign out", exact: true }).click(); await expect(page).toHaveURL(/\/login$/); await memberLogin(page); await page.evaluate(raw => sessionStorage.setItem("sfbb:cart", raw!), saved); await page.reload(); await expect(page.getByRole("button", { name: /Bag 0/ })).toBeVisible();
 });
});
test.describe("bag refresh", { tag: "@member-ui" }, () => {
 test("reloaded price changes are announced and catalogue removal events clear unsent lines", async ({ page, request }) => {
  const fixture = await memberFixture(request); await memberLogin(page); await addShirt(page);
  expect((await request.patch(`/api/admin/styles/${fixture.style.id}/price`, { headers: fixture.headers, data: { expectedVersion: fixture.style.version, unitPriceCents: 3000 } })).status()).toBe(200);
  await page.reload(); await page.getByRole("button", { name: /Bag 1/ }).click(); await expect(page.getByRole("dialog").getByRole("alert")).toContainText("changed");
  await page.evaluate(({ seasonId, styleId }) => window.dispatchEvent(new CustomEvent("sfbb:catalog-change", { detail: { seasonId, styleId, deletedStyleId: styleId } })), { seasonId: fixture.season.id, styleId: fixture.style.id });
  await expect(page.getByRole("dialog").getByText("Your bag is empty.")).toBeVisible();
 });
});
test.describe("bag quantity validation", { tag: "@member-ui" }, () => {
 test("invalid bag quantity stays editable with an inline error", async ({ page, request }) => {
  await memberFixture(request); await memberLogin(page); await addShirt(page); await page.getByRole("button", { name: /Bag 1/ }).click();
  const bag = page.getByRole("dialog", { name: "Your bag" }); await bag.getByRole("spinbutton", { name: /Quantity for/ }).fill("1.5"); await expect(bag.getByRole("alert")).toContainText("whole number"); await expect(bag).toBeVisible(); await bag.getByRole("spinbutton", { name: /Quantity for/ }).fill("2"); await expect(bag.getByText("$50.00", { exact: true })).toBeVisible();
 });
});
test.describe("restored page session", { tag: "@member-ui" }, () => {
 test("a restored page reloads when the shared login has a different verified session", async ({ page, request }) => {
  await memberFixture(request); await memberLogin(page); await addShirt(page);
  const auth = (await (await page.request.get("/api/auth/session")).json()).data;
  expect((await page.request.post("/api/auth/logout", { headers: { Origin: "http://127.0.0.1:3100", "X-CSRF-Token": auth.csrfToken } })).status()).toBe(200);
  const credentials = (await import("../fixtures/credentials.json", { with: { type: "json" } })).default;
  expect((await page.request.post("/api/auth/login", { headers: { Origin: "http://127.0.0.1:3100" }, data: { username: "user", password: credentials.memberPassword } })).status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("button", { name: /Bag 0/ })).toBeVisible();
 });
});
