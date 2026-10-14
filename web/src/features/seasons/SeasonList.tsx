"use client";
import type { SeasonSummary } from "./service";
export function seasonDates(season: SeasonSummary) {
  const format = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  return `${format(season.opensOn)} – ${format(season.closesOn)}`;
}
export function SeasonList({ seasons, onNew, onManage, onPublish, busy }: { seasons: SeasonSummary[]; onNew: () => void; onManage: (season: SeasonSummary) => void; onPublish: (season: SeasonSummary) => void; busy: boolean }) {
  return <section aria-label="Seasons"><div className="section-heading"><h2>Band seasons</h2><button type="button" className="primary" onClick={onNew} disabled={busy}>+ New season</button></div>
    <div className="season-list">{seasons.map(s => <article className="season-card" key={s.id}>
      <div><span className={`status-badge status-${s.lifecycle.toLowerCase()}`}>{s.status}</span><h3>{s.name}</h3><p>{seasonDates(s)}</p><p className="season-counts">{s.styleCount} shirt styles · {s.activeOrderCount} active orders</p></div>
      <div className="season-card-actions"><button type="button" className="secondary" disabled={busy} onClick={() => onManage(s)}>Manage</button><a className="secondary" href={`/shop?previewSeasonId=${s.id}`}>Preview shop ↗</a>{s.lifecycle === "DRAFT" && <button type="button" className="secondary" disabled={busy} onClick={() => onPublish(s)}>Publish season</button>}</div>
    </article>)}</div>
  </section>;
}
