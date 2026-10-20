import type { OrderView, OrderLineView, SeasonView } from "../../domain/types";
import { cartTotal } from "../orders/cart";
export type Report = "billing" | "member-delivery" | "product-delivery" | "manufacturer-order";
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sortedOrders = (orders: OrderView[]) => orders.filter(o => !o.cancelled).sort((a,b) => compare(a.fullName, b.fullName) || compare(a.code,b.code) || compare(a.id,b.id));
export function decimalCents(cents: bigint): string { return `${cents/100n}.${(cents%100n).toString().padStart(2,"0")}`; }
export function moneyLabel(cents: bigint): string { return `$${(cents/100n).toLocaleString("en-US")}.${(cents%100n).toString().padStart(2,"0")}`; }
export function dashboardMetrics(orders: OrderView[]) {
 const active = orders.filter(o => !o.cancelled);
 return { activeOrders: active.length, itemsToFulfill: active.filter(o => o.progress === "OPEN").reduce((sum,o) => sum+o.lines.reduce((q,l) => q+BigInt(l.quantity),0n),0n), amountOwedCents: active.filter(o => o.progress !== "COMPLETE").reduce((sum,o) => sum+BigInt(cartTotal(o.lines)),0n) };
}
// Names are the only collected customer identifier. Match exact names only;
// never merge different spellings using fuzzy/case-insensitive matching.
function customers(orders: OrderView[]) {
 const result = new Map<string,OrderView[]>();
 for (const order of sortedOrders(orders)) { const existing=result.get(order.fullName) ?? []; existing.push(order); result.set(order.fullName,existing); }
 return result;
}
export function billingRows(orders: OrderView[]): string[][] {
 const rows: string[][] = [["Name","Total T-shirts","Amount Owed","Paid?","Comment"]];
 let totalQuantity=0n, totalOwed=0n;
 for (const [name,customerOrders] of customers(orders)) {
  const quantity=customerOrders.reduce((sum,o)=>sum+o.lines.reduce((q,l)=>q+BigInt(l.quantity),0n),0n);
  const owed=customerOrders.reduce((sum,o)=>sum+(o.progress==="COMPLETE" ? 0n : BigInt(cartTotal(o.lines))),0n);
  const notes=[...new Set(customerOrders.map(o=>o.note).filter(Boolean))].join("\n");
  rows.push([name,quantity.toString(),decimalCents(owed),"",notes]);totalQuantity+=quantity;totalOwed+=owed;
 }
 if (rows.length>1) rows.push([],["Totals",totalQuantity.toString(),decimalCents(totalOwed),"",""]);
 return rows;
}
// Stable IDs and ordered snapshots define a variant; price/progress do not.
function identity(l: OrderLineView): string { return JSON.stringify([l.styleId,l.artworkSetId,l.colorId,l.sizeId,l.styleName,l.artworkSetName,l.colorName,l.colorHex,l.sizeLabel]); }
function group(lines: OrderLineView[]) {
 const result = new Map<string,{ line: OrderLineView; quantity: bigint }>();
 for (const line of lines) { const key = identity(line), previous = result.get(key); result.set(key, { line: previous?.line ?? line, quantity: (previous?.quantity ?? 0n)+BigInt(line.quantity) }); }
 return result;
}
function productName(l: OrderLineView): string { return `${l.styleName} — ${l.colorName} — ${l.artworkSetName}`; }
function sizeRank(label: string): number {
 const standard=["XXXS","XXS","XS","S","M","L","XL","2XL","3XL","4XL","5XL","6XL"];
 const normalized=label.toUpperCase().replace(/\s/g,"").replace(/^(\d+)X$/, "$1XL").replace(/^XXL$/,"2XL").replace(/^XXXL$/,"3XL");
 const index=standard.indexOf(normalized);return index<0 ? standard.length : index;
}
function variantCompare(a: OrderLineView,b: OrderLineView): number {
 for (const field of ["styleName","colorName","artworkSetName"] as const) { const result=compare(a[field],b[field]);if(result)return result; }
 return sizeRank(a.sizeLabel)-sizeRank(b.sizeLabel) || compare(a.sizeLabel,b.sizeLabel) || compare(identity(a),identity(b));
}
function sortedGroups(lines: OrderLineView[]) { return [...group(lines).values()].sort((a,b)=>variantCompare(a.line,b.line)); }
export function deliveryRows(orders: OrderView[]): string[][] {
 const rows: string[][]=[["Name","Product Name","Size","Quantity","Fulfilled"]];
 for (const [name,customerOrders] of customers(orders)) {
  const variants=sortedGroups(customerOrders.flatMap(o=>o.lines));if(!variants.length)continue;
  if(rows.length>1)rows.push([]);
  variants.forEach(({line,quantity},index)=>rows.push([index===0 ? name : "",productName(line),line.sizeLabel,quantity.toString(),""]));
 }
 return rows;
}
export function productDeliveryRows(orders: OrderView[]): string[][] {
 const rows: string[][]=[["Product Name","Size","Name","Quantity","Fulfilled"]];
 const variants=new Map<string,{line:OrderLineView;customers:Map<string,bigint>}>();
 for(const order of sortedOrders(orders)) for(const line of order.lines) {
  const key=identity(line),variant=variants.get(key) ?? {line,customers:new Map<string,bigint>()};
  variant.customers.set(order.fullName,(variant.customers.get(order.fullName) ?? 0n)+BigInt(line.quantity));variants.set(key,variant);
 }
 for(const {line,customers} of [...variants.values()].sort((a,b)=>variantCompare(a.line,b.line))) {
  if(rows.length>1)rows.push([]);
  let first=true;
  for(const [name,quantity] of customers) {
   rows.push([first ? productName(line) : "",first ? line.sizeLabel : "",name,quantity.toString(),""]);first=false;
  }
 }
 return rows;
}
export function manufacturerRows(orders: OrderView[]): string[][] {
 return [["Product Name","Size","Total","Ordered?"], ...sortedGroups(orders.filter(o=>!o.cancelled).flatMap(o=>o.lines)).map(({line,quantity})=>[productName(line),line.sizeLabel,quantity.toString(),""])];
}
export function csvEncode(rows: string[][]): Uint8Array {
 const cell = (value: string) => { const safe = /^[\t\r]|^\s*[=+\-@]/.test(value) ? `'${value}` : value; return `"${safe.replaceAll('"','""')}"`; };
 return new TextEncoder().encode("\uFEFF"+rows.map(row => row.map(cell).join(",")).join("\r\n")+"\r\n");
}
export function reportFilename(season: SeasonView, report: Report): string {
 const slug = season.name.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80).replace(/-+$/g,"") || "season";
 return `sfbb-${slug}-${season.opensOn}-${report}.csv`;
}
