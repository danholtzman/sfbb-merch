"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import type { SeasonSummary } from "./service";
import type { CreateSeasonInput, SeasonSettingsInput } from "./validation";
export type SeasonError = { message: string; code?: string; fields?: Record<string, string> };
export function ErrorMessage({ error }: { error: SeasonError | null }) {
  return error ? <div role="alert" className="form-error"><p>{error.message}</p>{error.fields && <ul>{Object.entries(error.fields).map(([key, value]) => <li key={key}>{value}</li>)}</ul>}</div> : null;
}
export function SeasonDialog({ season, seasons, today, onClose, onSubmit, onDelete }: {
  season: SeasonSummary | null; seasons: SeasonSummary[]; today: string; onClose: () => void;
  onSubmit: (input: CreateSeasonInput | SeasonSettingsInput) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [values, setValues] = useState<SeasonSettingsInput>({ name: season?.name ?? "", opensOn: season?.opensOn ?? today, closesOn: season?.closesOn ?? today, announcement: season?.announcement ?? "" });
  const [copyFromSeasonId, setCopyFromSeasonId] = useState("");
  const [reuseArtwork, setReuseArtwork] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SeasonError | null>(null);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e as SeasonError); } finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void run(() => onSubmit(season ? values : { ...values, copyFromSeasonId: copyFromSeasonId || null, reuseArtwork: !!copyFromSeasonId && reuseArtwork })); }
  return <Modal title={confirmDelete ? `Delete ${season!.name}?` : season ? `Manage ${season.name}` : "Create a new season"} onClose={onClose} busy={busy}>
    {confirmDelete ? <><p>Delete “{season!.name}” and its shirt styles, artwork sets, and placements? This cannot be undone. Seasons with orders, including cancelled orders, cannot be deleted. At least one season must remain.</p>
      <ErrorMessage error={error} /><div className="dialog-actions"><button type="button" className="danger" disabled={busy} onClick={() => void run(onDelete)}>Yes, delete season</button><button type="button" className="secondary" disabled={busy} onClick={() => { setConfirmDelete(false); setError(null); }}>Keep season</button></div></> :
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Season name<input autoFocus required maxLength={80} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} /></label>
          <div className="form-row"><label>Opens on<input type="date" required value={values.opensOn} onChange={e => setValues({ ...values, opensOn: e.target.value })} /></label>
            <label>Closes on<input type="date" required min={values.opensOn} value={values.closesOn} onChange={e => setValues({ ...values, closesOn: e.target.value })} /></label></div>
          <p className="field-help">Dates are inclusive and use San Francisco time.</p>
          <label>Member announcement<textarea rows={3} maxLength={2000} value={values.announcement} onChange={e => setValues({ ...values, announcement: e.target.value })} /></label>
          {!season && <><label>Starting merchandise<select value={copyFromSeasonId} onChange={e => { setCopyFromSeasonId(e.target.value); setReuseArtwork(false); }}><option value="">Start with no merchandise</option>{seasons.map(s => <option key={s.id} value={s.id}>Copy from {s.name}</option>)}</select></label>
            <label className="checkbox-label"><input type="checkbox" disabled={!copyFromSeasonId} checked={reuseArtwork} onChange={e => setReuseArtwork(e.target.checked)} />Also copy the previous season’s designs and placements</label>
            <p className="field-help">Copies shirt styles, colors, sizes, prices, and blank photos. Starts with one fresh front/back artwork set unless you choose to copy designs. Orders are never copied. The new season starts as a draft.</p></>}
        </fieldset>
        <ErrorMessage error={error} />
        <div className="dialog-actions"><button className="primary" disabled={busy} type="submit">{busy ? "Saving…" : season ? "Save season" : "Create season"}</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button>
          {season && <button type="button" className="danger delete-season" disabled={busy} onClick={() => { setConfirmDelete(true); setError(null); }}>Delete season</button>}</div>
      </form>}
  </Modal>;
}
