import { expect, it } from "vitest";
import { cartReducer, restoreCart, type CartState, type BagLine } from "../../src/features/orders/cart-state";
import type { ShopData, MemberOrder } from "../../src/features/orders/member-data";
const line: BagLine = { key: "one", styleId: "style", artworkSetId: "set", colorId: "blue", sizeId: "large", quantity: 1, unitPriceCents: 2500, styleName: "Tee", artworkSetName: "Pair", colorName: "Blue", colorHex: "#1247ED", sizeLabel: "L" };
const state: CartState = { seasonId: "season", preview: false, lines: [], editing: null };
it("merges current variants but keeps historical snapshots separate, and rejects fractional quantities", () => {
 let bag = cartReducer(state, { type: "ADD", line }); bag = cartReducer(bag, { type: "ADD", line: { ...line, key: "two", quantity: 2 } }); expect(bag.lines).toHaveLength(1); expect(bag.lines[0].quantity).toBe(3);
 bag = cartReducer(bag, { type: "ADD", line: { ...line, key: "three", colorHex: "#000000" } }); expect(bag.lines).toHaveLength(2);
 expect(() => cartReducer(bag, { type: "SET_QUANTITY", key: "one", quantity: 1.5 })).toThrow();
 expect(cartReducer(bag, { type: "REMOVE", key: "one" }).lines).toHaveLength(1);
});
it("revalidates current prices/removes unavailable unsent variants without deleting unchanged historical lines", () => {
 const catalog = { season: { id: "season" }, preview: false, styles: [{ id: "style", name: "Tee", unitPriceCents: 3200, colors: [{ id: "blue", name: "New", hex: "#000000" }], sizes: [{ id: "large", label: "L" }], artworkSetIds: [] }], artworkSets: [{ id: "set", name: "Pair" }] } as unknown as ShopData;
 const bag = { ...state, lines: [line, { ...line, key: "original", originalLineId: "original" }] };
 const refreshed = cartReducer(bag, { type: "REMOVE_UNAVAILABLE", catalog }); expect(refreshed.lines).toHaveLength(1); expect(refreshed.lines[0]).toMatchObject({ originalLineId: "original", unitPriceCents: 2500, colorHex: "#1247ED" });
 catalog.styles[0].artworkSetIds = ["set"];
 expect(cartReducer({ ...state, lines: [line] }, { type: "REMOVE_UNAVAILABLE", catalog }).lines[0]).toMatchObject({ unitPriceCents: 3200, colorName: "New", colorHex: "#000000" });
});
it("restores only the verified session's validated bag and clears edit state on season switch", () => {
 const serialized = JSON.stringify({ sessionId: "session-a", state: { ...state, lines: [line] } });
 expect(restoreCart(serialized, "session-b")).toBeNull(); expect(restoreCart(serialized, "session-a")?.lines).toHaveLength(1);
 expect(restoreCart("{bad", "session-a")).toBeNull(); expect(restoreCart(JSON.stringify({ sessionId: "session-a", state: { ...state, lines: [{ ...line, quantity: -1 }] } }), "session-a")).toBeNull();
 const editing = { seasonId: "season", lines: [{ ...line, id: "original" }] } as unknown as MemberOrder;
 const loaded = cartReducer(state, { type: "LOAD_ORDER", order: editing }); expect(loaded.lines[0].originalLineId).toBe("original");
 expect(cartReducer(loaded, { type: "CLEAR", seasonId: "next", preview: true })).toMatchObject({ seasonId: "next", preview: true, editing: null, lines: [] });
});
it("rejects bags beyond the server line limit and unsafe repriced totals", () => {
 const full = { ...state, lines: Array.from({ length: 100 }, (_, i) => ({ ...line, key: String(i), sizeId: String(i) })) };
 expect(() => cartReducer(full, { type: "ADD", line: { ...line, sizeId: "extra" } })).toThrow();
 const expensive = { season: { id: "season" }, preview: false, styles: [{ id: "style", name: "Tee", unitPriceCents: 2147483647, colors: [{ id: "blue", name: "Blue", hex: "#1247ED" }], sizes: [{ id: "large", label: "L" }], artworkSetIds: ["set"] }], artworkSets: [{ id: "set", name: "Pair" }] } as unknown as ShopData;
 expect(() => cartReducer({ ...state, lines: [{ ...line, quantity: 2147483647, unitPriceCents: 0 }] }, { type: "REMOVE_UNAVAILABLE", catalog: expensive })).toThrow();
});
