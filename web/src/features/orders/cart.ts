import type { OrderLineInput } from "../../domain/types";
import { quantitySchema, centsSchema } from "../../domain/schemas";
import { AppError } from "../../domain/errors";
type CartIdentity = OrderLineInput & { originalLineId?: string; unitPriceCents?: number; styleName?: string; artworkSetName?: string; colorName?: string; colorHex?: string; sizeLabel?: string };
export function variantKey(line: OrderLineInput): string { return JSON.stringify([line.styleId, line.artworkSetId, line.colorId, line.sizeId]); }
export function cartLineKey(line: CartIdentity): string { return JSON.stringify([variantKey(line), line.originalLineId, line.unitPriceCents, line.styleName, line.artworkSetName, line.colorName, line.colorHex, line.sizeLabel]); }
export function mergeCartLines<T extends CartIdentity>(lines: T[]): T[] {
 const merged = new Map<string, T>();
 for (const line of lines) {
  if (!quantitySchema.safeParse(line.quantity).success) throw new AppError("INVALID_QUANTITY", 422, "Quantities must be positive whole numbers within the supported range.");
  const key = cartLineKey(line), previous = merged.get(key), quantity = (previous?.quantity ?? 0) + line.quantity;
  if (!quantitySchema.safeParse(quantity).success) throw new AppError("INVALID_QUANTITY", 422, "Combined quantity is too large.");
  merged.set(key, { ...(previous ?? line), quantity });
 }
 return [...merged.values()];
}
export function cartTotal(lines: Array<OrderLineInput & { unitPriceCents: number }>): number {
 let total = 0n;
 for (const line of lines) {
  if (!quantitySchema.safeParse(line.quantity).success || !centsSchema.safeParse(line.unitPriceCents).success) throw new AppError("INVALID_AMOUNT", 422, "Invalid quantity or unit price.");
  total += BigInt(line.quantity) * BigInt(line.unitPriceCents);
 }
 if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new AppError("INVALID_AMOUNT", 422, "The order total exceeds the supported range.");
 return Number(total);
}
