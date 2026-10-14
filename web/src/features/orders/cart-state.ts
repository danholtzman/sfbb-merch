import type { OrderLineView } from "../../domain/types";
import type { MemberOrder, ShopData } from "./member-data";
export type BagLine = Omit<OrderLineView, "id"> & { key: string; originalLineId?: string };
export type CartState = { seasonId: string; preview: boolean; lines: BagLine[]; editing: MemberOrder | null };
export type CartAction = { type: "ADD"; line: BagLine } | { type: "SET_QUANTITY"; key: string; quantity: number } | { type: "REMOVE"; key: string } | { type: "LOAD_ORDER"; order: MemberOrder } | { type: "CLEAR"; seasonId?: string; preview?: boolean } | { type: "REMOVE_UNAVAILABLE"; catalog: ShopData };
import { z } from "zod";
import { cartLineKey, cartTotal, mergeCartLines } from "./cart";
function quantity(value: number) { if (!Number.isInteger(value) || value < 1 || value > 2147483647) throw new Error("Quantity must be a positive whole number."); }
export function cartReducer(state: CartState, action: CartAction): CartState {
 switch (action.type) {
  case "CLEAR": return { seasonId: action.seasonId ?? "", preview: action.preview ?? false, lines: [], editing: null };
  case "LOAD_ORDER": return { seasonId: action.order.seasonId, preview: false, editing: action.order, lines: action.order.lines.map(l => ({ ...l, key: l.id, originalLineId: l.id })) };
  case "ADD": { const lines = mergeCartLines([...state.lines, action.line]); if (lines.length > 100) throw new Error("Your bag can contain at most 100 item variants."); cartTotal(lines); return { ...state, lines }; }
  case "SET_QUANTITY": { quantity(action.quantity); const lines = state.lines.map(l => l.key === action.key ? { ...l, quantity: action.quantity } : l); cartTotal(lines); return { ...state, lines }; }
  case "REMOVE": return { ...state, lines: state.lines.filter(l => l.key !== action.key) };
  case "REMOVE_UNAVAILABLE": {
   if (state.seasonId !== action.catalog.season?.id || state.preview !== action.catalog.preview) return { seasonId: action.catalog.season?.id ?? "", preview: action.catalog.preview, lines: [], editing: null };
   const lines = state.lines.flatMap(l => {
    if (l.originalLineId) return [l];
    const style = action.catalog.styles.find(s => s.id === l.styleId), color = style?.colors.find(c => c.id === l.colorId), size = style?.sizes.find(s => s.id === l.sizeId), set = action.catalog.artworkSets.find(s => s.id === l.artworkSetId);
    if (!style || !color || !size || !set || !style.artworkSetIds.includes(set.id)) return [];
    return [{ ...l, unitPriceCents: style.unitPriceCents, styleName: style.name, colorName: color.name, colorHex: color.hex, sizeLabel: size.label, artworkSetName: set.name }];
   });
   const merged = mergeCartLines(lines); cartTotal(merged); return { ...state, lines: merged };
  }
 }
}
export function bagSignature(state: CartState): string { return JSON.stringify(state.lines.map(l => [cartLineKey(l), l.quantity])); }
const lineSchema = z.object({ key: z.string().min(1), originalLineId: z.string().optional(), styleId: z.string().min(1), artworkSetId: z.string().min(1), colorId: z.string().min(1), sizeId: z.string().min(1), quantity: z.number().int().min(1).max(2147483647), unitPriceCents: z.number().int().min(0).max(2147483647), styleName: z.string().max(60), artworkSetName: z.string().max(60), colorName: z.string().max(40), colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/), sizeLabel: z.string().max(40) });
export function restoreCart(raw: string | null, sessionId: string): CartState | null {
 try {
  if (!raw || raw.length > 1500000) return null;
  const stored = JSON.parse(raw); if (stored.sessionId !== sessionId) return null;
  const state = z.object({ seasonId: z.string(), preview: z.boolean(), lines: z.array(lineSchema).max(100), editing: z.unknown().nullable() }).parse(stored.state);
  cartTotal(state.lines);
  // Unsaved edits stay in memory. Never restore old edit records as authority.
  if (state.editing !== null) return null;
  return { ...state, editing: null };
 } catch { return null; }
}
