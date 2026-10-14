import { expect, it } from "vitest";
import { calendarDateSchema, lifecycleSchema, normalizedName, orderLineSchema, placementSchema, progressSchema } from "../../src/domain/schemas";
it("rejects invalid geometry while accepting the editor's limits", () => {
  expect(placementSchema.safeParse({ x: 0, y: 100, width: 90, rotation: -180 }).success).toBe(true);
  expect(placementSchema.safeParse({ x: 50, y: 47.7, width: 25, rotation: 0 }).success).toBe(true);
  for (const change of [{ x: -1 }, { y: 101 }, { width: 4.9 }, { width: 90.1 }, { rotation: 181 }, { x: NaN }]) {
    expect(placementSchema.safeParse({ x: 50, y: 47.7, width: 25, rotation: 0, ...change }).success).toBe(false);
  }
});
it("rejects invalid or non-integer quantities and malformed IDs", () => {
  const id = "ddf4a1de-0152-4997-8ba0-dc99f3e22293";
  const line = { styleId: id, artworkSetId: id, colorId: id, sizeId: id, quantity: 2 };
  expect(orderLineSchema.safeParse(line).success).toBe(true);
  for (const quantity of [0, -1, 1.5, Infinity]) expect(orderLineSchema.safeParse({ ...line, quantity }).success).toBe(false);
  expect(orderLineSchema.safeParse({ ...line, colorId: "missing" }).success).toBe(false);
});
it("validates real calendar dates and persisted workflow states", () => {
  expect(calendarDateSchema.safeParse("2028-02-29").success).toBe(true);
  expect(calendarDateSchema.safeParse("2027-02-29").success).toBe(false);
  expect(calendarDateSchema.safeParse("2026-13-01").success).toBe(false);
  expect(progressSchema.safeParse("DELIVERED_UNPAID").success).toBe(true);
  expect(progressSchema.safeParse("DELIVERED").success).toBe(false);
  expect(lifecycleSchema.safeParse("UNKNOWN").success).toBe(false);
});
it("normalizes case, Unicode and whitespace for scoped duplicate checks", () => {
  expect(normalizedName("  ＢLUE   Shirt ")).toBe("blue shirt");
});
