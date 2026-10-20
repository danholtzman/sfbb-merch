import { expect, it } from "vitest";
import type { OrderView, OrderLineView, SeasonView } from "../../src/domain/types";
import { billingRows, deliveryRows, productDeliveryRows, manufacturerRows, csvEncode, reportFilename } from "../../src/features/reports/rows";
const line: OrderLineView = { id: "line", styleId: "tee-a", artworkSetId: "pair-a", colorId: "blue", sizeId: "large", quantity: 2, unitPriceCents: 2510, styleName: "Classic Tee", artworkSetName: "Season pair", colorName: "Blue", colorHex: "#1247ED", sizeLabel: "L" };
const make = (input: Partial<OrderView> = {}): OrderView => ({ id: "order", code: "BR4SS2", seasonId: "season", fullName: "Alex", note: "Pickup", progress: "OPEN", cancelled: false, version: 1, lines: [line], amountOwedCents: 5020, ...input });
it("billing matches the reduced sample, groups exact customer names, and includes totals", () => {
 expect(billingRows([make({ fullName: "Zoe", cancelled: true }), make({ fullName: "Bea", progress: "COMPLETE", amountOwedCents: 999 }), make({ amountOwedCents: 999 }), make({ id:"second",code:"CCC333",note:"Second note",lines:[{...line,quantity:1}] })])).toEqual([
  ["Name","Total T-shirts","Amount Owed","Paid?","Comment"], ["Alex","3","75.30","","Pickup\nSecond note"], ["Bea","2","0.00","","Pickup"], [], ["Totals","5","75.30","",""]
 ]);
});
it("customer fulfillment matches grouped sample rows and combines customer variants across orders", () => {
 const result = deliveryRows([make({ fullName: "Bea", code: "CCC333", progress: "COMPLETE" }), make({ code: "BBB222", progress: "DELIVERED_UNPAID" }), make({ code: "AAA222", lines: [line, { ...line, id: "duplicate", quantity: 1 }, { ...line, id: "historical", colorName: "Old blue", colorHex: "#000080" }] }), make({ cancelled: true })]);
 expect(result).toEqual([["Name","Product Name","Size","Quantity","Fulfilled"], ["Alex","Classic Tee — Blue — Season pair","L","5",""], ["","Classic Tee — Old blue — Season pair","L","2",""], [], ["Bea","Classic Tee — Blue — Season pair","L","2",""]]);
});
it("product fulfillment lists each customer under its product/size with blank checklist cells",()=>{
 expect(productDeliveryRows([make({fullName:"Bea",lines:[{...line,quantity:1}]}),make(),make({code:"NEXT22",lines:[{...line,quantity:1}]}),make({cancelled:true})])).toEqual([
  ["Product Name","Size","Name","Quantity","Fulfilled"], ["Classic Tee — Blue — Season pair","L","Alex","3",""], ["","","Bea","1",""]
 ]);
 const different=productDeliveryRows([make(),make({fullName:"Bea",lines:[{...line,sizeId:"small",sizeLabel:"S"}]})]);
 expect(different.slice(1)).toEqual([["Classic Tee — Blue — Season pair","S","Bea","2",""],[],["Classic Tee — Blue — Season pair","L","Alex","2",""]]);
});
it("shirt ordering matches the sample and retains historical identities across all progress states", () => {
 const orders = [make(), make({ progress: "DELIVERED_UNPAID" }), make({ progress: "COMPLETE" }), make({ lines: [{ ...line, styleId: "tee-b", quantity: 1 }] }), make({ lines: [{ ...line, colorHex: "#000080", quantity: 1 }] }), make({ lines: [{ ...line, styleName: "Another tee", quantity: 1 }] }), make({ cancelled: true })];
 expect(manufacturerRows(orders)).toEqual([["Product Name","Size","Total","Ordered?"], ["Another tee — Blue — Season pair","L","1",""], ["Classic Tee — Blue — Season pair","L","1",""], ["Classic Tee — Blue — Season pair","L","6",""], ["Classic Tee — Blue — Season pair","L","1",""]]);
 expect(manufacturerRows([...orders].reverse())).toEqual(manufacturerRows(orders));
 const sizes=["3XL","L","XS","2XL","S","XL","M"];
 expect(manufacturerRows([make({lines:sizes.map(size=>({...line,sizeId:size,sizeLabel:size}))})]).slice(1).map(r=>r[1])).toEqual(["XS","S","M","L","XL","2XL","3XL"]);
});
it("CSV quotes every cell, escapes multiline Unicode text, adds BOM/CRLF and neutralizes formula prefixes including whitespace", () => {
 const bytes = csvEncode([["Name", "Note"], ['Zoë, "Brass"', "Line 1\nLine 2"], ["=SUM(1)", "+1"], ["-1", "@test"], ["\tformula", "\rformula"], ["  =SUM(1)", "0.00"]]);
 expect([...bytes.slice(0,3)]).toEqual([239,187,191]);
 expect(new TextDecoder().decode(bytes)).toBe('"Name","Note"\r\n"Zoë, ""Brass""","Line 1\nLine 2"\r\n"\'=SUM(1)","\'+1"\r\n"\'-1","\'@test"\r\n"\'\tformula","\'\rformula"\r\n"\'  =SUM(1)","0.00"\r\n');
});
it("filenames normalize accented names, cap slugs at 80 characters, include the opening date and fallback safely", () => {
 const season = { name: "Été & Brass / 2027", opensOn: "2027-09-01" } as SeasonView;
 expect(reportFilename(season, "billing")).toBe("sfbb-ete-brass-2027-2027-09-01-billing.csv");
 expect(reportFilename({ ...season, name: "音楽" }, "member-delivery")).toBe("sfbb-season-2027-09-01-member-delivery.csv");
 expect(reportFilename({ ...season, name: "a".repeat(90) }, "manufacturer-order")).toBe(`sfbb-${"a".repeat(80)}-2027-09-01-manufacturer-order.csv`);
});
it("empty exports contain only their exact header and can aggregate quantities above a single line's bound", () => {
 expect(billingRows([])).toEqual([["Name","Total T-shirts","Amount Owed","Paid?","Comment"]]);
 expect(deliveryRows([])).toEqual([["Name","Product Name","Size","Quantity","Fulfilled"]]);
 expect(productDeliveryRows([])).toEqual([["Product Name","Size","Name","Quantity","Fulfilled"]]);
 expect(manufacturerRows([])).toEqual([["Product Name","Size","Total","Ordered?"]]);
 expect(manufacturerRows([make({ lines: [{ ...line, quantity: 2147483647 }] }), make({ lines: [{ ...line, quantity: 2147483647 }] })])[1][2]).toBe("4294967294");
});
it("real DB exports are season scoped, snapshot based, and reject member/revoked sessions", async () => {
 const { testDatabase, seedCatalog, lineData } = await import("../fixtures/database"); const { createReportService } = await import("../../src/features/reports/service"); const { randomUUID } = await import("node:crypto");
 const database = await testDatabase();
 try {
  const first = await seedCatalog(database.client), other = await seedCatalog(database.client);
  const session = await database.client.session.create({ data: { role: "admin", tokenHash: randomUUID(), csrfTokenHash: "a".repeat(64), expiresAt: new Date("2030-01-01") } });
  const ctx = { actor: { role: "admin" as const, sessionId: session.id }, now: new Date("2026-10-14") }, service = createReportService(database.client);
  await database.client.order.create({ data: { seasonId: first.season.id, code: "BR4SS2", fullName: "Chosen", note: "Original", lines: { create: lineData(first) } } });
  await database.client.order.create({ data: { seasonId: other.season.id, code: "BR4SS3", fullName: "Other season", lines: { create: lineData(other) } } });
  await database.client.order.create({ data: { seasonId: first.season.id, code: "BR4SS4", fullName: "Cancelled", cancelled: true, lines: { create: lineData(first) } } });
  await database.client.styleColor.update({ where: { id: first.color.id }, data: { name: "Current", hex: "#000000" } });
  const report = await service.export(ctx,first.season.id,"member-delivery");
  expect(report.filename).toBe("sfbb-test-season-2026-10-01-member-delivery.csv");
  expect(new TextDecoder().decode(report.bytes)).toBe('"Name","Product Name","Size","Quantity","Fulfilled"\r\n"Chosen","Classic Tee — Blue — Season artwork","L","2",""\r\n');
  const productReport=await service.export(ctx,first.season.id,"product-delivery");
  expect(productReport.filename).toBe("sfbb-test-season-2026-10-01-product-delivery.csv");
  expect(new TextDecoder().decode(productReport.bytes)).toBe('"Product Name","Size","Name","Quantity","Fulfilled"\r\n"Classic Tee — Blue — Season artwork","L","Chosen","2",""\r\n');
  await expect(service.export({ ...ctx, actor: { ...ctx.actor, role: "member" } },first.season.id,"billing")).rejects.toMatchObject({ status: 403 });
  await database.client.session.delete({ where: { id: session.id } });
  await expect(service.export(ctx,first.season.id,"billing")).rejects.toMatchObject({ status: 401 });
 } finally { await database.close(); }
});
