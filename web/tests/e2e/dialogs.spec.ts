import { test, expect } from "@playwright/test";
import { memberFixture, memberLogin } from "./member-setup";
test.describe("member dialogs", { tag: "@member-ui" }, () => {
 test("drag_inside_to_curtain_keeps_dialog_open; curtain_click_closes_dialog; keyboard focus restores", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "Pointer curtain scenario on desktop"); await memberFixture(request); await memberLogin(page);
  const trigger = page.getByRole("button", { name: /Bag 0/ }); await trigger.click(); const dialog = page.getByRole("dialog", { name: "Your bag" }); const bounds = (await dialog.boundingBox())!;
  await page.mouse.move(bounds.x+50, bounds.y+150); await page.mouse.down(); await page.mouse.move(100,150,{ steps: 10 }); await page.mouse.up(); await expect(dialog).toBeVisible();
  await page.mouse.click(100,150); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.querySelector("dialog")?.contains(document.activeElement))).toBe(true); await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
 });
});
