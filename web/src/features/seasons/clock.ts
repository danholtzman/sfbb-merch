import { bandDate } from "../../domain/clock";
import type { SeasonView } from "../../domain/types";
export function isOrderingOpen(season: SeasonView, now: Date): boolean {
  const today = bandDate(now);
  return season.lifecycle === "PUBLISHED" && season.opensOn <= today && today <= season.closesOn;
}
export function seasonStatus(season: SeasonView, now: Date): string {
  if (season.lifecycle === "DRAFT") return "Draft";
  if (season.lifecycle === "ARCHIVED") return "Archived";
  if (isOrderingOpen(season, now)) return "Orders open";
  return bandDate(now) < season.opensOn ? "Scheduled" : "Closed";
}
export function preferredSeason(seasons: SeasonView[], now: Date): SeasonView | undefined {
  return seasons.find(s => isOrderingOpen(s, now)) ?? seasons.find(s => s.lifecycle === "PUBLISHED") ?? seasons[0];
}
