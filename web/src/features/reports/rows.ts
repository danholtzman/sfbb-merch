import type { OrderView, OrderLineView, SeasonView } from "../../domain/types";
import { cartTotal } from "../orders/cart";
export type Report = "billing" | "member-delivery" | "manufacturer-order";
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sortedOrders = (orders: OrderView[]) => orders.filter(o => !o.cancelled).sort((a,b) => compare(a.fullName, b.fullName) || compare(a.code,b.code) || compare(a.id,b.id));
export function decimalCents(cents: bigint): string { return `${cents/100n}.${(cents%100n).toString().padStart(2,"0")}`; }
export function moneyLabel(cents: bigint): string { return `$${(cents/100n).toLocaleString("en-US")}.${(cents%100n).toString().padStart(2,"0")}`; }
export function dashboardMetrics(orders: OrderView[]) {
 const active = orders.filter(o => !o.cancelled);
 return { activeOrders: active.length, itemsToFulfill: active.filter(o => o.progress === "OPEN").reduce((sum,o) => sum+o.lines.reduce((q,l) => q+BigInt(l.quantity),0n),0n), amountOwedCents: active.filter(o => o.progress !== "COMPLETE").reduce((sum,o) => sum+BigInt(cartTotal(o.lines)),0n) };
}
export function billingRows(orders: OrderView[]): string[][] {
 return [["Order code","Full name","Quantity","Amount owed","Note"], ...sortedOrders(orders).map(o => [o.code,o.fullName,o.lines.reduce((q,l) => q+BigInt(l.quantity),0n).toString(), decimalCents(o.progress === "COMPLETE" ? 0n : BigInt(cartTotal(o.lines))),o.note])];
}
// Reports retain stable references AND ordered display/color snapshots. Unit price
// does not split a packing/manufacturer variant because neither report lists prices.
function identity(l: OrderLineView): string { return JSON.stringify([l.styleId,l.artworkSetId,l.colorId,l.sizeId,l.styleName,l.artworkSetName,l.colorName,l.colorHex,l.sizeLabel]); }
function group(lines: OrderLineView[]) {
 const result = new Map<string,{ line: OrderLineView; quantity: bigint }>();
 for (const line of lines) { const key = identity(line), previous = result.get(key); result.set(key, { line: previous?.line ?? line, quantity: (previous?.quantity ?? 0n)+BigInt(line.quantity) }); }
 return result;
}
export function deliveryRows(orders: OrderView[]): string[][] {
 return [["Full name","Order code","Item","Artwork set","Color","Size","Quantity","Note"], ...sortedOrders(orders).flatMap(o => [...group(o.lines).values()].map(({line:l,quantity}) => [o.fullName,o.code,l.styleName,l.artworkSetName,l.colorName,l.sizeLabel,quantity.toString(),o.note]))];
}
export function manufacturerRows(orders: OrderView[]): string[][] {
 const grouped = [...group(orders.filter(o => !o.cancelled).flatMap(o => o.lines)).entries()].sort(([ka,a],[kb,b]) => {
  for (const field of ["styleName","artworkSetName","colorName","sizeLabel"] as const) { const result = compare(a.line[field],b.line[field]); if (result) return result; }
  return compare(ka,kb);
 });
 return [["Item","Artwork set","Color","Size","Quantity"], ...grouped.map(([, {line:l,quantity}]) => [l.styleName,l.artworkSetName,l.colorName,l.sizeLabel,quantity.toString()])];
}
export function csvEncode(rows: string[][]): Uint8Array {
 const cell = (value: string) => { const safe = /^[\t\r]|^\s*[=+\-@]/.test(value) ? `'${value}` : value; return `"${safe.replaceAll('"','""')}"`; };
 return new TextEncoder().encode("\uFEFF"+rows.map(row => row.map(cell).join(",")).join("\r\n")+"\r\n");
}
export function reportFilename(season: SeasonView, report: Report): string {
 const slug = season.name.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80).replace(/-+$/g,"") || "season";
 return `sfbb-${slug}-${season.opensOn}-${report}.csv`;
}
