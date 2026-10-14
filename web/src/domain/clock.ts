import { AppError } from "./errors";
const dateFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
export function bandDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new AppError("INVALID_DATE", 422, "Invalid date.");
  const parts = dateFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
