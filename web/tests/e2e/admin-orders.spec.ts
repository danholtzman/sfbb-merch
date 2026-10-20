import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { memberFixture } from "./member-setup";
import credentials from "../fixtures/credentials.json" with { type: "json" };
// Independent CSV parser: commas/newlines in quoted text must survive downloads.
function parseCsv(text: string): string[][] {
 const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
 for (let i=0;i<text.length;i++) { const char=text[i]; if (i===0 && char==="\uFEFF") continue;
  if (char==='"') { if (quoted && text[i+1]==='"') { cell+='"'; i++; } else quoted=!quoted; }
  else if (!quoted && char===",") { row.push(cell); cell=""; }
  else if (!quoted && char==="\r" && text[i+1]==="\n") { row.push(cell); rows.push(row); row=[]; cell=""; i++; }
  else cell+=char;
 }
 return rows;
}
test.describe("admin order management", { tag: "@admin-orders" }, () => {
 test.beforeEach(({ isMobile }) => { test.skip(isMobile,"Order administration is desktop only"); });
 test("edits, preserves status, cancels/restores, and downloads all selected-season CSVs regardless of search", async ({ page, request }, info) => {
  const fixture = await memberFixture(request);
  const line = { styleId: fixture.style.id, artworkSetId: fixture.set.id, colorId: fixture.style.colors[0].id, sizeId: fixture.style.sizes[0].id, quantity: 2 };
  const orders = [];
  for (const [name, quantity] of [["Alex Morgan",2],["Bea Chen",3],["Cancelled Member",1]] as const) {
   const response = await request.post("/api/orders", { headers: { ...fixture.headers, "Idempotency-Key": randomUUID() }, data: { seasonId: fixture.season.id, fullName: name, note: name === "Alex Morgan" ? 'Pickup, "please"\nThank you' : "", lines: [{ ...line, quantity }] } }); expect(response.status()).toBe(200); orders.push((await response.json()).data);
  }
  expect((await request.post(`/api/admin/orders/${orders[2].id}/cancel`, { headers: fixture.headers, data: { expectedVersion: 1 } })).status()).toBe(200);
  await page.goto("/login"); await page.getByLabel("Username",{exact:true}).fill("admin"); await page.getByLabel("Password",{exact:true}).fill(credentials.adminPassword); await page.getByRole("button",{name:/Sign in/}).click(); await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("active-orders")).toHaveText("2"); await expect(page.getByTestId("items-to-fulfill")).toHaveText("5"); await expect(page.getByTestId("total-owed")).toHaveText("$125.00");
  const alex = page.getByRole("row").filter({ hasText: "Alex Morgan" }); await alex.getByRole("combobox",{name:"Order status for Alex Morgan"}).selectOption("COMPLETE"); await expect(page.getByTestId("total-owed")).toHaveText("$75.00");
  const heights=await Promise.all([alex.getByRole("combobox"),alex.getByRole("button",{name:"View ↗",exact:true})].map(locator=>locator.evaluate(element=>element.getBoundingClientRect().height))); expect(heights).toEqual([40,40]);
  await alex.getByRole("button",{name:"View ↗",exact:true}).click(); const actionMetrics = await Promise.all(["Edit order","Cancel order"].map(name=>page.getByRole("button",{name,exact:true}).evaluate(element=>{const css=getComputedStyle(element);return [css.fontFamily,css.fontSize,css.fontWeight,element.getBoundingClientRect().height];}))); expect(actionMetrics[0]).toEqual(actionMetrics[1]);
  await page.getByRole("button",{name:"Edit order",exact:true}).click(); const editor = page.getByRole("dialog",{name:"Edit order"});
  await editor.getByLabel("Full name",{exact:true}).fill("Alex Revised"); await editor.getByLabel("Quantity",{exact:true}).fill("4"); await editor.getByLabel("Unit price ($)",{exact:true}).fill("12.50"); await editor.getByRole("button",{name:"Save order",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); const revised = page.getByRole("row").filter({hasText:"Alex Revised"}); await expect(revised.getByRole("combobox")).toHaveValue("COMPLETE"); await expect(revised.getByText(orders[0].code)).toBeVisible();
  await revised.getByRole("button",{name:"View ↗",exact:true}).click(); await page.getByRole("button",{name:"Cancel order",exact:true}).click(); await page.getByRole("button",{name:`Yes, cancel order ${orders[0].code}`}).click(); await expect(page.getByRole("dialog").getByText("Cancelled",{exact:true})).toBeVisible(); await page.getByRole("button",{name:"Restore order",exact:true}).click(); await expect(page.getByRole("dialog").getByText("Complete",{exact:true})).toBeVisible(); await page.getByRole("button",{name:"Close dialog"}).click();
  await page.getByRole("textbox",{name:"Search orders"}).fill("Alex Revised"); await expect(page.getByRole("row").filter({hasText:"Bea Chen"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"↓ Delivery by item & artwork CSV",exact:true})).toHaveCount(0);
  const expected = [
   ["Billing CSV",["Full name","Order code","Total T-shirts","Amount Owed","Paid?","Comment"],4,"billing"],
   ["Fulfillment by customer CSV",["Name","Item","Artwork set","Color","Size","Quantity","Fulfilled"],3,"fulfillment-by-member"],
   ["Fulfillment by product CSV",["Item","Artwork set","Color","Size","Quantity","Fulfilled"],1,"fulfillment-by-product"],
   ["T-shirt ordering CSV",["Item","Artwork set","Color","Size","Total","Ordered?"],1,"manufacturer-order"]
  ] as const;
  for (const [button,header,count,suffix] of expected) {
   const downloadPromise=page.waitForEvent("download"); await page.getByRole("button",{name:`↓ ${button}`,exact:true}).click(); const download=await downloadPromise;
   expect(download.suggestedFilename()).toContain(`${fixture.season.opensOn}-${suffix}.csv`); expect(download.suggestedFilename()).toContain("sfbb-member-ui-");
   const bytes=await readFile((await download.path())!); expect([...bytes.subarray(0,3)]).toEqual([239,187,191]); const rows=parseCsv(bytes.toString("utf8")); expect(rows[0]).toEqual(header); expect(rows).toHaveLength(count+1); expect(bytes.toString("utf8")).not.toContain("Cancelled Member");
   if (suffix==="billing") { expect(rows.slice(1,3).map(r=>[r[0],r[1],r[2],r[3]])).toEqual([["Alex Revised",orders[0].code,"4","0.00"],["Bea Chen",orders[1].code,"3","75.00"]]); expect(rows[1][5]).toBe('Pickup, "please"\nThank you'); }
   if (suffix==="manufacturer-order") expect(rows[1]).toEqual([fixture.style.name,fixture.set.name,"Blue","L","7",""]);
   if (suffix==="billing") expect(rows.at(-1)).toEqual(["Totals","","7","75.00","",""]);
   if (suffix==="fulfillment-by-member") expect(rows[1]).toEqual(["Alex Revised",fixture.style.name,fixture.set.name,"Blue","L","4",""]);
   if (suffix==="fulfillment-by-product") expect(rows[1]).toEqual([fixture.style.name,fixture.set.name,"Blue","L","7",""]);
  }
  await page.screenshot({path:info.outputPath("admin-orders.png"),fullPage:true});
 });
 test("CSV buttons retain their labels, dimensions and opacity while a download is pending", async ({page,request})=>{
  await memberFixture(request);
  await page.goto("/login"); await page.getByLabel("Username",{exact:true}).fill("admin"); await page.getByLabel("Password",{exact:true}).fill(credentials.adminPassword); await page.getByRole("button",{name:/Sign in/}).click(); await expect(page).toHaveURL(/\/admin$/);
  const buttons=page.locator(".order-exports button"), billing=page.getByRole("button",{name:"↓ Billing CSV",exact:true});
  await expect(billing).toBeEnabled();
  const appearance=()=>buttons.evaluateAll(elements=>elements.map(element=>{const bounds=element.getBoundingClientRect(),css=getComputedStyle(element);return {label:element.textContent,width:bounds.width,height:bounds.height,opacity:css.opacity};}));
  const before=await appearance();
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/admin/reports/billing?*",async route=>{await pending;await route.continue();});
  const download=page.waitForEvent("download");await billing.click();
  try {
   await expect(billing).toBeDisabled();
   expect(await appearance()).toEqual(before);
  } finally {release();}
  await download;await expect(billing).toBeEnabled();expect(await appearance()).toEqual(before);
 });
 test("admin edits work after closing, discard preserves data, and conflicts preserve unsaved editor input", async ({ page, request }) => {
  const fixture = await memberFixture(request); const payload = { seasonId: fixture.season.id, fullName: "Closed Member", note: "Original", lines: [{styleId:fixture.style.id,artworkSetId:fixture.set.id,colorId:fixture.style.colors[0].id,sizeId:fixture.style.sizes[0].id,quantity:1}] };
  const submitted=await request.post("/api/orders",{headers:{...fixture.headers,"Idempotency-Key":randomUUID()},data:payload}); expect(submitted.status()).toBe(200); const order=(await submitted.json()).data;
  const current=(await (await request.get("/api/admin/seasons")).json()).data.find((s:{id:string})=>s.id===fixture.season.id);
  expect((await request.patch(`/api/admin/seasons/${current.id}`,{headers:fixture.headers,data:{expectedVersion:current.version,name:current.name,opensOn:"1790-01-01",closesOn:"1790-01-01",announcement:""}})).status()).toBe(200);
  await page.goto("/login"); await page.getByLabel("Username",{exact:true}).fill("admin"); await page.getByLabel("Password",{exact:true}).fill(credentials.adminPassword); await page.getByRole("button",{name:/Sign in/}).click(); await page.getByRole("combobox",{name:"Switch season"}).selectOption(fixture.season.id);
  const row=page.getByRole("row").filter({hasText:"Closed Member"}); await row.getByRole("button",{name:"View ↗",exact:true}).click(); await page.getByRole("button",{name:"Edit order",exact:true}).click(); await page.getByLabel("Full name",{exact:true}).fill("Discarded"); await page.getByRole("button",{name:"Discard changes",exact:true}).click(); await expect(row).toBeVisible();
  await row.getByRole("button",{name:"View ↗",exact:true}).click(); await page.getByRole("button",{name:"Edit order",exact:true}).click(); await page.getByLabel("Full name",{exact:true}).fill("Closed Revised"); await page.getByRole("button",{name:"Save order",exact:true}).click();
  const revised=page.getByRole("row").filter({hasText:"Closed Revised"}); await expect(revised).toBeVisible(); await revised.getByRole("button",{name:"View ↗",exact:true}).click(); await page.getByRole("button",{name:"Edit order",exact:true}).click(); await page.getByLabel("Full name",{exact:true}).fill("Unsaved admin name");
  expect((await request.patch(`/api/admin/orders/${order.id}/progress`,{headers:fixture.headers,data:{expectedVersion:2,progress:"DELIVERED_UNPAID"}})).status()).toBe(200);
  await page.getByRole("button",{name:"Save order",exact:true}).click(); await expect(page.getByRole("dialog").getByRole("alert")).toContainText("changed"); await expect(page.getByLabel("Full name",{exact:true})).toHaveValue("Unsaved admin name");
 });
});
test.describe("admin item editor safeguards", { tag: "@admin-orders" }, () => {
 test("style changes reset dependent variants/prices, originals retain snapshots, empty reports and role guards hold", async ({ page, request, isMobile }, info) => {
  test.skip(isMobile,"Desktop admin only"); const fixture=await memberFixture(request);
  const submit=await request.post("/api/orders",{headers:{...fixture.headers,"Idempotency-Key":randomUUID()},data:{seasonId:fixture.season.id,fullName:"Variant Member",note:"",lines:[{styleId:fixture.style.id,artworkSetId:fixture.set.id,colorId:fixture.style.colors[0].id,sizeId:fixture.style.sizes[0].id,quantity:2}]}}); expect(submit.status()).toBe(200); const original=(await submit.json()).data;
  const price=await request.patch(`/api/admin/styles/${fixture.style.id}/price`,{headers:fixture.headers,data:{expectedVersion:fixture.style.version,unitPriceCents:3500}}); expect(price.status()).toBe(200);
  expect((await request.patch(`/api/admin/styles/${fixture.style.id}/colors`,{headers:fixture.headers,data:{expectedVersion:(await price.json()).data.version,colors:[{id:fixture.style.colors[0].id,name:"Current blue",hex:"#003399"}]}})).status()).toBe(200);
  const created=await request.post(`/api/admin/seasons/${fixture.season.id}/catalog`,{headers:fixture.headers,data:{name:"Encore tee",description:"Fitted",unitPriceCents:3100,cut:"fitted",colors:[{name:"Gold",hex:"#DDCC11"},{name:"Black",hex:"#111111"}],sizes:["S","L"]}}); expect(created.status()).toBe(200); const newStyle=(await created.json()).data;
  await page.goto("/login"); await page.getByLabel("Username",{exact:true}).fill("admin"); await page.getByLabel("Password",{exact:true}).fill(credentials.adminPassword); await page.getByRole("button",{name:/Sign in/}).click(); const row=page.getByRole("row").filter({hasText:"Variant Member"}); await row.getByRole("button",{name:"View ↗",exact:true}).click(); await page.getByRole("button",{name:"Edit order",exact:true}).click(); const editor=page.getByRole("dialog");
  await expect(editor.getByLabel("Unit price ($)",{exact:true})).toHaveValue("25.00"); await expect(editor.getByRole("combobox",{name:"Color",exact:true}).locator("option:checked")).toHaveText("Blue (ordered)");
  await editor.getByRole("button",{name:"+ Add item",exact:true}).click(); const added=editor.getByRole("region",{name:"Item 2",exact:true}); await added.getByRole("combobox",{name:"Shirt style",exact:true}).selectOption(newStyle.id); await expect(added.getByLabel("Unit price ($)",{exact:true})).toHaveValue("31.00"); await expect(added.getByRole("combobox",{name:"Color",exact:true}).locator("option:checked")).toHaveText("Gold"); await expect(added.getByRole("combobox",{name:"Size",exact:true}).locator("option:checked")).toHaveText("S");
  await page.screenshot({path:info.outputPath("admin-editor.png"),fullPage:true}); await editor.getByRole("button",{name:"Save order",exact:true}).click(); await expect(editor).toHaveCount(0);
  const saved=(await (await request.get(`/api/admin/orders?seasonId=${fixture.season.id}`)).json()).data[0]; expect(saved).toMatchObject({code:original.code,amountOwedCents:8100,version:2,lines:[{colorName:"Blue",colorHex:"#1247ED",unitPriceCents:2500},{styleId:newStyle.id,colorName:"Gold",sizeLabel:"S",unitPriceCents:3100}]});
  await row.getByRole("button",{name:"View ↗",exact:true}).click(); await page.getByRole("button",{name:"Edit order",exact:true}).click(); await editor.getByRole("button",{name:"Remove item",exact:true}).first().click(); await editor.getByRole("button",{name:"Remove item",exact:true}).click(); await expect(editor.getByRole("button",{name:"Save order",exact:true})).toBeDisabled(); await editor.getByRole("button",{name:"Discard changes",exact:true}).click();
  const first=(await (await request.get("/api/admin/seasons")).json()).data.find((s:{name:string})=>s.name==="First season"); await page.getByRole("combobox",{name:"Switch season"}).selectOption(first.id); await expect(page.getByTestId("active-orders")).toHaveText("0"); const downloadPromise=page.waitForEvent("download"); await page.getByRole("button",{name:"↓ Billing CSV",exact:true}).click(); const download=await downloadPromise; expect(download.suggestedFilename()).toBe("sfbb-first-season-2026-10-01-billing.csv"); expect(parseCsv((await readFile((await download.path())!)).toString("utf8"))).toEqual([["Full name","Order code","Total T-shirts","Amount Owed","Paid?","Comment"]]);
  const login=await request.post("/api/auth/login",{headers:{Origin:"http://127.0.0.1:3100"},data:{username:"user",password:credentials.memberPassword}}); expect(login.status()).toBe(200);
  expect((await request.get(`/api/admin/reports/billing?seasonId=${fixture.season.id}`,{headers:{"X-Role":"admin"}})).status()).toBe(403);
  expect((await request.post("/api/auth/logout",{headers:{Origin:"http://127.0.0.1:3100","X-CSRF-Token":(await login.json()).data.csrfToken}})).status()).toBe(200); expect((await request.get(`/api/admin/reports/billing?seasonId=${fixture.season.id}`)).status()).toBe(401);
 });
});
