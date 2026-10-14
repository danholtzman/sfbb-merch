"use client";
import { useState } from "react";
import { SeasonList, seasonDates } from "./SeasonList";
import { SeasonDialog, ErrorMessage, type SeasonError } from "./SeasonDialog";
import { preferredSeason } from "./clock";
import type { SeasonSummary } from "./service";
import type { CreateSeasonInput, SeasonSettingsInput } from "./validation";
function clearSeasonWork() {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try { window[name].removeItem("sfbb:cart"); window[name].removeItem("sfbb:editing-order"); } catch { /* Storage may be disabled. */ }
  }
  window.dispatchEvent(new Event("sfbb:season-change"));
}
export function AdminSeasons({ initial, csrfToken, today, now }: { initial: SeasonSummary[]; csrfToken: string; today: string; now: string }) {
  const [seasons, setSeasons] = useState(initial);
  const [selectedId, setSelectedId] = useState(preferredSeason(initial, new Date(now))?.id ?? "");
  const [tab, setTab] = useState<"orders" | "merchandise" | "seasons">("orders");
  const [dialog, setDialog] = useState<{ season: SeasonSummary | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SeasonError | null>(null);
  const selected = seasons.find(s => s.id === selectedId);
  async function request<T>(url: string, method = "GET", input?: unknown): Promise<T> {
    let response: Response;
    try { response = await fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, ...(input ? { body: JSON.stringify(input) } : {}) }); }
    catch { throw { message: "Unable to reach the site. Please try again." }; }
    const payload = await response.json();
    if (!response.ok) throw payload.error;
    return payload.data as T;
  }
  async function refresh() { const list = await request<SeasonSummary[]>("/api/admin/seasons"); setSeasons(list); return list; }
  function select(id: string) { if (id !== selectedId) { clearSeasonWork(); setSelectedId(id); } }
  async function save(input: CreateSeasonInput | SeasonSettingsInput) {
    const editing = dialog?.season;
    const saved = await request<SeasonSummary>(editing ? `/api/admin/seasons/${editing.id}` : "/api/admin/seasons", editing ? "PATCH" : "POST", editing ? { ...input, expectedVersion: editing.version } : input);
    await refresh(); select(saved.id); setDialog(null); setError(null);
    if (!editing) setTab("merchandise");
  }
  async function remove() {
    const season = dialog!.season!;
    const result = await request<{ selectedSeasonId: string }>(`/api/admin/seasons/${season.id}`, "DELETE", { expectedVersion: season.version });
    await refresh(); clearSeasonWork(); setSelectedId(result.selectedSeasonId); setDialog(null); setTab("seasons"); setError(null);
  }
  async function publish(season: SeasonSummary) {
    setBusy(true); setError(null);
    try { await request(`/api/admin/seasons/${season.id}/publish`, "POST", { expectedVersion: season.version }); await refresh(); }
    catch (e) { setError(e as SeasonError); } finally { setBusy(false); }
  }
  return <section className="desktop-only admin-dashboard"><h1>Merchandise admin</h1>
    {tab !== "seasons" && selected && <div className="season-context" data-testid="season-context"><div><span className="eyebrow">Selected season</span><h2>{selected.name}</h2><p>{seasonDates(selected)}</p></div><div className="season-switch"><label>Switch season<select value={selectedId} onChange={e => select(e.target.value)}>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><span className={`status-badge status-${selected.lifecycle.toLowerCase()}`}>{selected.status}</span></div></div>}
    <div role="tablist" aria-label="Administration" className="admin-tabs">{(["orders", "merchandise", "seasons"] as const).map(t => <button key={t} role="tab" id={`tab-${t}`} aria-controls={`panel-${t}`} aria-selected={tab === t} onClick={() => { setTab(t); setError(null); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
    <ErrorMessage error={error} />
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === "seasons" ? <SeasonList seasons={seasons} onNew={() => setDialog({ season: null })} onManage={season => { select(season.id); setDialog({ season }); }} onPublish={s => void publish(s)} busy={busy} /> : <section className="admin-placeholder"><h2>{tab === "orders" ? "Orders" : "Merchandise"}</h2><p>{tab === "orders" ? "Order management is not available yet." : "Shirt style and artwork management will be added in the next stages."}</p></section>}
    </div>
    {dialog && <SeasonDialog key={dialog.season?.id ?? "new"} season={dialog.season} seasons={seasons} today={today} onClose={() => setDialog(null)} onSubmit={save} onDelete={remove} />}
  </section>;
}
