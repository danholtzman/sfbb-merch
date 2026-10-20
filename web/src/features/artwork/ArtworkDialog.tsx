"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated upload thumbnails must be fetched directly with the browser session cookie. */
import { useState } from "react";
import { Modal } from "../../components/Modal";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
import { catalogRequest, notifyCatalogChange } from "../catalog/api";
import type { ArtworkSetView } from "../../domain/types";
import { UploadField, uploadImage } from "./UploadField";
export function ArtworkDialog({ sets, seasonId, csrfToken, onClose, onChanged }: { sets: ArtworkSetView[]; seasonId: string; csrfToken: string; onClose: () => void; onChanged: () => Promise<void> }) {
 const [selectedId, setSelectedId] = useState(sets[0]?.id), [newName, setNewName] = useState("");
 const [busy, setBusy] = useState(false), [error, setError] = useState<SeasonError | null>(null), [confirm, setConfirm] = useState(false);
 const selected = sets.find(s => s.id === selectedId) ?? sets[0];
 const replacement = sets.find(s => s.id !== selected?.id);
 async function run(work: () => Promise<void>) { setBusy(true); setError(null); try { await work(); } catch (e) { setError(e as SeasonError); } finally { setBusy(false); } }
 return <Modal title={confirm ? `Delete ${selected.name}?` : "Manage artwork"} onClose={onClose} busy={busy}>
  {confirm ? <><p>Delete both sides of “{selected.name}” and its saved placements? Styles using only this set will switch to “{replacement?.name}”. Blank shirt photos remain. Sets used by an order cannot be deleted.</p><ErrorMessage error={error} /><div className="dialog-actions"><button className="danger" disabled={busy} onClick={() => void run(async () => { const result = await catalogRequest<{ replacementSetId: string }>(csrfToken, `/api/admin/artwork-sets/${selected.id}`, "DELETE", { expectedVersion: selected.version, expectedReplacementSetId: replacement!.id }); await onChanged(); notifyCatalogChange({ seasonId, styleId: "", removedSetIds: [selected.id] }); setSelectedId(result.replacementSetId); setConfirm(false); })}>Yes, delete artwork set</button><button className="secondary" disabled={busy} onClick={() => { setConfirm(false); setError(null); }}>Keep artwork set</button></div></> : <>
   <fieldset disabled={busy}>{sets.length > 1 ? <label>Artwork set<select value={selected.id} onChange={e => setSelectedId(e.target.value)}>{sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : <h3>Season artwork set: {selected.name}</h3>}
    <p className="field-help">Front artwork is required to publish; back artwork is optional. Upload transparent PNGs, up to 8 MB each. Artwork is applied separately to each shirt style.</p>
    <div className="artwork-slots">{(["front", "back"] as const).map(side => { const assetId = selected[side === "front" ? "frontAssetId" : "backAssetId"]; return <section className="artwork-slot" key={side}><h3>{side === "front" ? "Front artwork" : "Back artwork (optional)"}</h3>{assetId ? <img src={`/api/assets/${assetId}`} alt={`${side === "front" ? "Front" : "Back"} artwork preview`} /> : <div className="empty-upload">{side === "front" ? "Front" : "Back"} artwork not uploaded</div>}<UploadField label={`Upload ${side} artwork`} accept="image/png" onFile={file => run(async () => { await uploadImage(csrfToken, `/api/admin/artwork-sets/${selected.id}/${side}`, file, selected.version); await onChanged(); })} /></section>; })}</div>
    <details><summary>Additional artwork sets (optional)</summary><div className="additional-set"><label>New set name<input maxLength={60} value={newName} onChange={e => setNewName(e.target.value)} /></label><button type="button" className="secondary" disabled={!newName.trim()} onClick={() => void run(async () => { const set = await catalogRequest<ArtworkSetView>(csrfToken, `/api/admin/seasons/${seasonId}/artwork-sets`, "POST", { name: newName }); await onChanged(); setSelectedId(set.id); setNewName(""); })}>Add artwork set</button></div></details>
   </fieldset><ErrorMessage error={error} /><div className="dialog-actions"><button className="primary" disabled={busy} onClick={onClose}>Done</button><button className="danger delete-season" disabled={busy || !replacement} onClick={() => setConfirm(true)}>Delete artwork set</button></div>{!replacement && <p className="field-help">Keep at least one artwork set in the season.</p>}
  </>}
 </Modal>;
}
