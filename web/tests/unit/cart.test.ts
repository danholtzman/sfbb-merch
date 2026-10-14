import { expect, it } from "vitest";
import { mergeCartLines, cartTotal, cartLineKey } from "../../src/features/orders/cart";
import { generateOrderCode, normalizeCode } from "../../src/features/orders/code";
const line = { styleId: "s", artworkSetId: "a", colorId: "c", sizeId: "m", quantity: 2, unitPriceCents: 2510 };
it("merges current variants, preserving different variants and historical snapshots/line identities", () => {
 const original = { ...line, originalLineId: "old", colorName: "Blue", colorHex: "#1247ED" };
 const merged = mergeCartLines([line, { ...line, quantity: 1 }, { ...line, sizeId: "l" }, original]);
 expect(merged).toHaveLength(3); expect(merged[0].quantity).toBe(3); expect(line.quantity).toBe(2);
 expect(cartLineKey(original)).not.toBe(cartLineKey({ ...original, colorHex: "#000000" }));
 expect(cartTotal(merged)).toBe(17570);
});
it("rejects nonpositive/fractional/overflowed quantities and unsafe totals", () => {
 for (const quantity of [0,-1,1.5,2147483648]) expect(() => mergeCartLines([{ ...line, quantity }])).toThrow();
 expect(() => mergeCartLines([{ ...line, quantity: 2147483647 }, line])).toThrow();
 expect(() => cartTotal([{ ...line, quantity: 2147483647, unitPriceCents: 2147483647 }])).toThrow();
});
it("generates six unbiased uppercase lookup characters and normalizes only its alphabet", () => {
 for (let i=0;i<20;i++) expect(generateOrderCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
 expect(normalizeCode(" abc234 ")).toBe("ABC234"); for (const code of ["ABC123","SHORT","ABCDEFG","!BC234"]) expect(normalizeCode(code)).toBeNull();
});
