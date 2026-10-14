import { expect, it } from "vitest";
import { DEFAULT_PLACEMENT, placementTransform, resolvePlacement } from "../../src/features/artwork/composite";
it("matches the normalized 320×310 artwork-box transform", () => {
 expect(placementTransform(DEFAULT_PLACEMENT)).toBe("translate(160 147.87) rotate(0) scale(1) translate(-160 -148)");
 expect(placementTransform({ x: 25, y: 50, width: 50, rotation: 90 })).toBe("translate(80 155) rotate(90) scale(2) translate(-160 -148)");
});
it("uses a color override, then shared placement, then a fresh default", () => {
 const shared = { x: 30, y: 40, width: 25, rotation: 0 }, override = { ...shared, x: 75 };
 expect(resolvePlacement(shared, override)).toEqual(override);
 expect(resolvePlacement(shared, null)).toEqual(shared);
 expect(resolvePlacement(null, null)).toEqual(DEFAULT_PLACEMENT);
 expect(resolvePlacement(null, null)).not.toBe(DEFAULT_PLACEMENT);
});
