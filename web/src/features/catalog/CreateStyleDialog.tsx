"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { parseUsd } from "../../domain/money";
import { ColorRows, type ColorDraft } from "./ColorRows";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
import { catalogRequest } from "./api";
import type { CatalogStyle } from "./service";
const defaults = { name: "", description: "", price: "25", cut: "classic", sizes: "XS, S, M, L, XL, 2XL, 3XL" };
export function CreateStyleDialog({ styles, seasonId, csrfToken, onClose, onCreated }: { styles: CatalogStyle[]; seasonId: string; csrfToken: string; onClose: () => void; onCreated: (style: CatalogStyle) => Promise<void> }) {
 const [values, setValues] = useState(defaults), [template, setTemplate] = useState("");
 const [colors, setColors] = useState<ColorDraft[]>([{ key: "initial", name: "Band blue", hex: "#1349DF" }]);
 const [busy, setBusy] = useState(false), [error, setError] = useState<SeasonError | null>(null);
 function choose(value: string) {
  setTemplate(value);
  const style = styles.find(s => s.id === value);
  if (style) { setValues({ name: style.name, description: style.description, price: (style.unitPriceCents / 100).toFixed(2), cut: style.cut, sizes: style.sizes.map(s => s.label).join(", ") }); setColors(style.colors.map(c => ({ key: c.id, name: c.name, hex: c.hex }))); }
  else { const cut = value.split(":")[1] ?? "classic"; setValues({ ...defaults, cut, name: value ? ({ classic: "Classic Tee", fitted: "Fitted Tee", long: "Long Sleeve" } as Record<string, string>)[cut] : "" }); setColors([{ key: "initial", name: "Band blue", hex: "#1349DF" }]); }
 }
 async function submit(event: FormEvent) {
  event.preventDefault(); setBusy(true); setError(null);
  try {
   const style = await catalogRequest<CatalogStyle>(csrfToken, `/api/admin/seasons/${seasonId}/catalog`, "POST", { name: values.name, description: values.description, unitPriceCents: parseUsd(values.price), cut: values.cut, colors: colors.map(({ name, hex }) => ({ name, hex })), sizes: values.sizes.split(",").map(s => s.trim()).filter(Boolean), ...(styles.some(s => s.id === template) ? { templateStyleId: template } : {}) });
   await onCreated(style);
  } catch (e) { setError(e as SeasonError); } finally { setBusy(false); }
 }
 return <Modal title="Add a shirt style" onClose={onClose} busy={busy}><form onSubmit={submit}><fieldset disabled={busy}>
  <label>Start from<select value={template} onChange={e => choose(e.target.value)}><option value="">New custom style</option><optgroup label="Sample styles"><option value="sample:classic">Regular short sleeve</option><option value="sample:fitted">Fitted short sleeve</option><option value="sample:long">Long sleeve</option></optgroup>{!!styles.length && <optgroup label="This season">{styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}</select></label>
  <label>Style name<input autoFocus required maxLength={60} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} /></label>
  <label>Description<input maxLength={160} value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} /></label>
  <div className="form-row"><label>Price ($)<input type="number" min="0" step="0.01" required value={values.price} onChange={e => setValues({ ...values, price: e.target.value })} /></label><label>Sample shirt shape<select value={values.cut} onChange={e => setValues({ ...values, cut: e.target.value })}><option value="classic">Regular short sleeve</option><option value="fitted">Fitted short sleeve</option><option value="long">Long sleeve</option></select></label></div>
  <p className="field-help">The sample shape is a fallback until real blank shirt photos are uploaded.</p>
  <section><h3>Available colors</h3><ColorRows rows={colors} setRows={setColors} /></section>
  <label>Available sizes<input required maxLength={1000} value={values.sizes} onChange={e => setValues({ ...values, sizes: e.target.value })} /></label><p className="field-help">Separate labels with commas, such as Youth S or 4XL. All season artwork sets are included.</p>
  </fieldset><ErrorMessage error={error} /><div className="dialog-actions"><button className="primary" disabled={busy} type="submit">{busy ? "Adding…" : "Add shirt style"}</button><button className="secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
 </form></Modal>;
}
