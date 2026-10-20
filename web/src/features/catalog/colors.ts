import { z } from "zod";
import { normalizedName, idSchema, centsSchema } from "../../domain/schemas";
import { AppError } from "../../domain/errors";
export const colorSchema = z.strictObject({ id: idSchema.optional(), name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(s => s.toUpperCase()) });
export const colorsSchema = z.array(colorSchema).min(1).max(100);
export const manufacturerUrlSchema = z.string().trim().max(2048).refine(value => { if (!value) return true; try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; } }, "Enter a valid HTTP or HTTPS URL.");
export const styleDetailsSchema = z.strictObject({ description: z.string().trim().max(160), manufacturerUrl: manufacturerUrlSchema });
export const createStyleSchema = z.strictObject({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(160), manufacturerUrl: manufacturerUrlSchema.default(""), unitPriceCents: centsSchema, cut: z.enum(["classic", "fitted", "long"]), colors: z.array(colorSchema.omit({ id: true })).min(1).max(100), sizes: z.array(z.string().trim().min(1).max(40)).min(1).max(100), templateStyleId: idSchema.optional(), artworkSetIds: z.array(idSchema).min(1).max(100).optional(), blankPhotos: z.array(z.strictObject({ colorPosition: z.number().int().min(0).max(99), side: z.enum(["front", "back"]), assetId: idSchema })).max(200).default([]) });
export type CreateStyleInput = z.input<typeof createStyleSchema>;
export type ColorInput = z.input<typeof colorSchema>;
export function parseCatalog<T>(schema: z.ZodType<T>, raw: unknown): T {
 const result = schema.safeParse(raw);
 if (!result.success) throw new AppError("INVALID_INPUT", 422, "Please check the shirt style fields.", Object.fromEntries(result.error.issues.map(i => [i.path.join("."), i.message])));
 return result.data;
}
export function validateColorNames(colors: ColorInput[]) {
 const names = new Set<string>(), ids = new Set<string>();
 for (const c of colors) {
  const normalized = normalizedName(c.name);
  if (names.has(normalized)) throw new AppError("INVALID_INPUT", 422, "Color names must be unique, ignoring case and extra spaces.");
  if (c.id && ids.has(c.id)) throw new AppError("INVALID_INPUT", 422, "Each color may appear only once.");
  names.add(normalized); if (c.id) ids.add(c.id);
 }
}
export function uniqueSizes(labels: string[]) { const seen = new Set<string>(); return labels.filter(label => { const key = normalizedName(label); if (seen.has(key)) return false; seen.add(key); return true; }); }
