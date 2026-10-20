import { expect, test } from "@playwright/test";
import credentials from "../fixtures/credentials.json" with { type: "json" };

test("shared member login, Show/Hide and server logout", async ({ page, context }, testInfo) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome, band." })).toBeVisible();
  await expect(page.getByText(/Try the mockup accounts|band2026|admin2026|Create account|Sign up/i)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  await page.getByLabel("Username", { exact: true }).fill("user");
  await page.getByLabel("Password", { exact: true }).fill(credentials.memberPassword);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("heading", { name: "Season shop" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  const cookies = await context.cookies();
  const cookie = cookies.find(c => c.name === "sfbb_session")!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const stale = await page.request.get("/api/auth/session", { headers: { Cookie: `sfbb_session=${cookie.value}` } });
  expect(stale.status()).toBe(401);
});

test("admin desktop access and mobile member experience", async ({ page, isMobile }) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill(credentials.adminPassword);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  if (isMobile) {
    await expect(page.getByRole("heading", { name: "Season shop" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Merchandise admin" })).not.toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Merchandise admin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Member orders", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(1);
  }
  expect((await page.request.get("/api/admin/session")).status()).toBe(200);
});

test("unauthenticated and member access cannot open admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/admin/session")).status()).toBe(401);
  await page.getByLabel("Username", { exact: true }).fill("user");
  await page.getByLabel("Password", { exact: true }).fill(credentials.memberPassword);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/shop$/);
  expect((await page.request.get("/api/admin/session", { headers: { "X-Role": "admin" } })).status()).toBe(403);
});

test("login errors use a generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("user");
  await page.getByLabel("Password", { exact: true }).fill("Wrong test password");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Username or password is incorrect. Please try again.");
});

test("sign out still redirects when browser storage is unavailable", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("user");
  await page.getByLabel("Password", { exact: true }).fill(credentials.memberPassword);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "removeItem", { value: () => { throw new DOMException("Storage disabled", "SecurityError"); } });
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/auth/session")).status()).toBe(401);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("never submits a password in the URL", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username", { exact: true }).fill("user");
    await page.getByLabel("Password", { exact: true }).fill("Test-only-noscript-password");
    const navigation = page.waitForRequest(request => request.isNavigationRequest());
    await page.getByRole("button", { name: /Sign in/ }).click();
    const submitted = await navigation;
    expect(submitted.method()).toBe("POST");
    expect(submitted.url()).not.toContain("password");
  });
});

for (const field of ["Username", "Password"]) test(`Enter in ${field} submits login`, async ({ page }) => {
 await page.goto("/login");
 await page.getByLabel("Username", { exact: true }).fill("user");
 await page.getByLabel("Password", { exact: true }).fill(credentials.memberPassword);
 await page.getByLabel(field, { exact: true }).press("Enter");
 await expect(page).toHaveURL(/\/shop$/);
});
