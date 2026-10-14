import { AppError } from "./errors";

/** Prisma SQLite Int stores unit prices as signed 32-bit integer cents. */
export const MAX_UNIT_PRICE_CENTS = 2147483647;
export function parseUsd(text: string): number {
  if (typeof text !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new AppError("INVALID_MONEY", 422, "Enter a nonnegative USD amount with at most two decimal places.");
  }
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(MAX_UNIT_PRICE_CENTS)) throw new AppError("INVALID_MONEY", 422, "Unit price exceeds the supported range.");
  return Number(cents);
}
export function formatUsd(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new AppError("INVALID_MONEY", 422, "Amount must be nonnegative integer cents.");
  const value = BigInt(cents);
  return `$${(value / 100n).toLocaleString("en-US")}.${(value % 100n).toString().padStart(2, "0")}`;
}
