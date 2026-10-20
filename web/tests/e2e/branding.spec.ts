import { test, expect } from "@playwright/test";
import credentials from "../fixtures/credentials.json" with { type: "json" };
for(const scheme of ["light","dark"] as const) test(`header stays light and favicon follows ${scheme} appearance`,async({page},info)=>{
 await page.emulateMedia({colorScheme:scheme});await page.goto("/login");
 const loginLogo=page.locator(".login-story .brand img");
 await expect(loginLogo).toBeVisible();await expect.poll(()=>loginLogo.evaluate(image=>(image as HTMLImageElement).currentSrc)).toContain("sfbb-logo-dark.png");
 const favicon=page.locator(`link[rel="icon"][media="(prefers-color-scheme: ${scheme})"]`);
 await expect(favicon).toHaveAttribute("href",`/brand/favicon-${scheme}.png`);
 await page.getByLabel("Username",{exact:true}).fill("user");await page.getByLabel("Password",{exact:true}).fill(credentials.memberPassword);await page.getByRole("button",{name:/Sign in/}).click();await expect(page).toHaveURL(/\/shop$/);
 await expect(page.locator(".site-header")).toHaveCSS("color","rgb(21, 25, 31)");
 const logo=page.locator(".site-header .brand img");await expect(logo).toBeVisible();
 await expect.poll(()=>logo.evaluate(image=>(image as HTMLImageElement).currentSrc)).toContain("sfbb-logo.png");
 await expect.poll(()=>logo.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.screenshot({path:info.outputPath(`branding-${scheme}.png`),fullPage:true});
});
