"use client";
import { useState } from "react";
import { BlankPhotos } from "../artwork/BlankPhotos";
import { Modal } from "../../components/Modal";
import { parseUsd } from "../../domain/money";
import type { ArtworkSetView } from "../../domain/types";
import { ColorRows, type ColorDraft } from "./ColorRows";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
import { catalogRequest } from "./api";
import type { CatalogStyle } from "./service";
export function StyleDialog({ style, sets, csrfToken, onClose, onUpdated, onDeleted }: { style: CatalogStyle; sets: ArtworkSetView[]; csrfToken: string; onClose: () => void; onUpdated: (style: CatalogStyle) => Promise<void>; onDeleted: (id: string) => Promise<void> }) {
 const [description, setDescription] = useState(style.description), [manufacturerUrl, setManufacturerUrl] = useState(style.manufacturerUrl);
 const [price, setPrice] = useState((style.unitPriceCents / 100).toFixed(2));
 const [colors, setColors] = useState<ColorDraft[]>(style.colors.map(c => ({ id: c.id, key: c.id, name: c.name, hex: c.hex })));
 const [busy, setBusy] = useState(false), [error, setError] = useState<SeasonError | null>(null), [message, setMessage] = useState("");
 const [confirm, setConfirm] = useState(false);
 async function run(work: () => Promise<void>) { setBusy(true); setError(null); setMessage(""); try { await work(); } catch (e) { setError(e as SeasonError); } finally { setBusy(false); } }
 async function savePrice() {
  await run(async () => { const cents = parseUsd(price); if (cents === style.unitPriceCents) return; const next = await catalogRequest<CatalogStyle>(csrfToken, `/api/admin/styles/${style.id}/price`, "PATCH", { expectedVersion: style.version, unitPriceCents: cents }); await onUpdated(next); setPrice((next.unitPriceCents / 100).toFixed(2)); setMessage("Price saved"); });
 }
 async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  await run(async () => { const next = await catalogRequest<CatalogStyle>(csrfToken, `/api/admin/styles/${style.id}`, "PATCH", { expectedVersion: style.version, description, manufacturerUrl }); await onUpdated(next); setDescription(next.description); setManufacturerUrl(next.manufacturerUrl); setMessage("Style details saved"); });
 }
 async function saveColors() {
  await run(async () => { const next = await catalogRequest<CatalogStyle>(csrfToken, `/api/admin/styles/${style.id}/colors`, "PATCH", { expectedVersion: style.version, colors: colors.map(({ id, name, hex }) => ({ ...(id ? { id } : {}), name, hex })) }); await onUpdated(next); setColors(next.colors.map(c => ({ id: c.id, key: c.id, name: c.name, hex: c.hex }))); setMessage("Colors saved"); });
 }
 async function changeSet(id: string, checked: boolean) {
  await run(async () => { const setIds = checked ? [...style.artworkSetIds, id] : style.artworkSetIds.filter(s => s !== id); const next = await catalogRequest<CatalogStyle>(csrfToken, `/api/admin/styles/${style.id}/artwork-sets`, "PATCH", { expectedVersion: style.version, setIds }); await onUpdated(next); setMessage("Artwork availability saved"); });
 }
 return <Modal title={confirm ? `Delete ${style.name}?` : `Manage ${style.name}`} onClose={onClose} busy={busy}>
  {confirm ? <><p>Delete “{style.name}” and its blank photos, placements, and unsent bag items? Artwork sets remain available to other styles. Styles used by any order, including cancelled orders, cannot be deleted.</p><ErrorMessage error={error} /><div className="dialog-actions"><button className="danger" disabled={busy} onClick={() => void run(async () => { await catalogRequest(csrfToken, `/api/admin/styles/${style.id}`, "DELETE", { expectedVersion: style.version }); await onDeleted(style.id); })}>Yes, delete style</button><button className="secondary" disabled={busy} onClick={() => { setConfirm(false); setError(null); }}>Keep style</button></div></> : <>
   <form onSubmit={saveDetails}><fieldset disabled={busy}>
    <label>Description<input maxLength={160} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>Manufacturer URL (optional)<input type="url" maxLength={2048} placeholder="https://" value={manufacturerUrl} onChange={e => setManufacturerUrl(e.target.value)} /></label>
    <button className="secondary" type="submit">Save style details</button>
   </fieldset></form>
   <fieldset disabled={busy}><label>Price ($)<input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} onBlur={() => void savePrice()} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
    <p className="field-help">Price saves when you leave the field. Existing order prices stay unchanged.</p>
    {sets.length > 1 && <section><h3>Available artwork sets</h3>{sets.map(s => <label className="checkbox-label" key={s.id}><input type="checkbox" checked={style.artworkSetIds.includes(s.id)} onChange={e => void changeSet(s.id, e.target.checked)} />{s.name}</label>)}<p className="field-help">Keep at least one set. Changes save immediately.</p></section>}
    <section><h3>Available colors</h3><ColorRows rows={colors} setRows={setColors} orderedColorIds={style.orderedColorIds} /><button type="button" className="secondary" onClick={() => void saveColors()}>Save colors</button><p className="field-help colors-help">Remove stages a change. Save colors applies it; Done discards unsaved color changes.</p></section>
    <BlankPhotos style={style} csrfToken={csrfToken} run={run} onSaved={async (next, message) => { await onUpdated(next); setMessage(message); }} />
   </fieldset><ErrorMessage error={error} />{message && <p role="status" className="saved-message">{message}</p>}
   <div className="dialog-actions"><button className="primary" disabled={busy} onClick={onClose}>Done</button><button className="danger delete-season" disabled={busy} onClick={() => { setConfirm(true); setError(null); }}>Delete style</button></div>
  </>}
 </Modal>;
}
