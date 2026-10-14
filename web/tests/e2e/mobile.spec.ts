import { test, expect } from "@playwright/test";
import { memberFixture, memberLogin, addShirt } from "./member-setup";
import credentials from "../fixtures/credentials.json" with { type: "json" };
test.describe("responsive member controls", { tag: "@member-ui" }, () => {
 for (const width of [390,320]) test(`ordering and lookup fit ${width}px phones with aligned controls`, async ({ page, request, isMobile }, info) => {
  test.skip(!isMobile, "Phone layout only"); await memberFixture(request); await page.setViewportSize({ width, height: width === 390 ? 844 : 740 }); await memberLogin(page);
  const card = page.getByRole("article").first(); const controls = [card.getByRole("combobox", { name: "Size" }), card.getByRole("spinbutton", { name: "Qty" }), card.getByRole("button", { name: "Add +", exact: true })];
  const metrics = await Promise.all(controls.map(control => control.evaluate(element => { const rect = element.getBoundingClientRect(), css = getComputedStyle(element); return { top: rect.top, bottom: rect.bottom, height: rect.height, size: css.fontSize, line: css.lineHeight, family: css.fontFamily }; })));
  for (const metric of metrics) { expect(metric.height).toBe(46); expect(metric.size).toBe("14px"); expect(metric.line).toBe("20px"); expect(metric.family).toContain("Arial"); expect(metric.top).toBe(metrics[0].top); expect(metric.bottom).toBe(metrics[0].bottom); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width); await page.screenshot({ path: info.outputPath(`shop-${width}.png`), fullPage: true });
  await addShirt(page); await page.getByRole("button", { name: /Bag 1/ }).click(); const drawer = await page.getByRole("dialog").boundingBox(); expect(drawer?.width).toBe(width); expect(drawer?.height).toBe(width === 390 ? 844 : 740);
  await page.screenshot({ path: info.outputPath(`bag-${width}.png`) }); await page.getByRole("button", { name: "Continue to checkout" }).click(); await page.getByLabel("Full name", { exact: true }).fill("Mobile Member"); await page.getByRole("button", { name: "Place order" }).click(); await expect(page.getByTestId("order-code")).toBeVisible(); const code = await page.getByTestId("order-code").innerText();
  await page.screenshot({ path: info.outputPath(`confirmation-${width}.png`) }); await page.getByRole("button", { name: "Return to shop" }).click(); await page.getByRole("link", { name: "Find my order" }).click(); await page.getByLabel("Order code", { exact: true }).fill(code); await page.getByRole("button", { name: "Look up order" }).click(); await expect(page.getByRole("dialog", { name: "Mobile Member’s order" })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
 });
 test("admin sign-in on phone provides the live member shop", async ({ page, request, isMobile }) => {
  test.skip(!isMobile, "Phone only"); await memberFixture(request); await page.goto("/login"); await page.getByLabel("Username", { exact: true }).fill("admin"); await page.getByLabel("Password", { exact: true }).fill(credentials.adminPassword); await page.getByRole("button", { name: /Sign in/ }).click(); await expect(page).toHaveURL(/\/admin$/); await expect(page.getByRole("article")).toBeVisible(); await expect(page.getByRole("link", { name: "Admin", exact: true })).not.toBeVisible(); await addShirt(page); await page.getByRole("button", { name: /Bag 1/ }).click(); await expect(page.getByRole("dialog", { name: "Your bag" })).toBeVisible();
 });
});
