import { z } from "zod";
import { MAX_UNIT_PRICE_CENTS } from "./money";

export const idSchema = z.uuid();
export const roleSchema = z.enum(["member", "admin"]);
export const sideSchema = z.enum(["front", "back"]);
export const progressSchema = z.enum(["OPEN", "DELIVERED_UNPAID", "COMPLETE"]);
export const lifecycleSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const versionSchema = z.number().int().min(1).max(2147483647);
export const centsSchema = z.number().int().min(0).max(MAX_UNIT_PRICE_CENTS);
export const quantitySchema = z.number().int().min(1).max(2147483647);
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(text => {
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}, "Enter a real calendar date.");
export const placementSchema = z.strictObject({
  x: z.number().min(0).max(100), y: z.number().min(0).max(100),
  width: z.number().min(5).max(90), rotation: z.number().min(-180).max(180),
});
export const orderLineSchema = z.strictObject({
  styleId: idSchema, artworkSetId: idSchema, colorId: idSchema, sizeId: idSchema, quantity: quantitySchema,
});
export const adminOrderLineSchema = orderLineSchema.extend({ unitPriceCents: centsSchema, originalLineId: idSchema.optional() });
export function normalizedName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
