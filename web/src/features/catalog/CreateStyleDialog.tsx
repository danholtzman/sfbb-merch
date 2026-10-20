"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { parseUsd } from "../../domain/money";
import { ColorRows, type ColorDraft } from "./ColorRows";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
import { catalogRequest } from "./api";
import type { CatalogStyle } from "./service";
import type { ArtworkSetView } from "../../domain/types";
import { DraftBlankPhotos, type DraftPhotos } from "./DraftBlankPhotos";
import { uploadImage } from "../artwork/UploadField";
import { createStyleSchema, parseCatalog, validateColorNames } from "./colors";
const defaults = { name: "", description: "", manufacturerUrl: "", price: "25", cut: "classic", sizes: "XS, S, M, L, XL, 2XL, 3XL" };
export function CreateStyleDialog({ styles, sets, seasonId, csrfToken, onClose, onCreated }: { styles: CatalogStyle[]; sets: ArtworkSetView[]; seasonId: string; csrfToken: string; onClose: () => void; onCreated: (style: CatalogStyle) => Promise<void> }) {
 const [values, setValues] = useState(defaults), [template, setTemplate] = useState("");
 const [colors, setColors] = useState<ColorDraft[]>([{ key: "initial", name: "Band blue", hex: "#1349DF" }]);
 const [setIds,setSetIds] = useState(sets.map(set=>set.id)), [photos,setPhotos] = useState<DraftPhotos>({});
 const urls=useRef(new Set<string>()), stored=useRef(new Map<File,string>());
 useEffect(()=>{const tracked=urls.current;return ()=>{for(const url of tracked)URL.revokeObjectURL(url);};},[]);
 function changePhoto(key:string,side:"front"|"back",file:File|null) {
  const previous=photos[key]?.[side];if(previous){URL.revokeObjectURL(previous.url);urls.current.delete(previous.url);}
  const photo=file ? {file,url:URL.createObjectURL(file)} : undefined;if(photo)urls.current.add(photo.url);
  setPhotos(current=>({...current,[key]:{...current[key],[side]:photo}}));
 }
 const [busy, setBusy] = useState(false), [error, setError] = useState<SeasonError | null>(null);
 function choose(value: string) {
  setTemplate(value); setPhotos({}); setSetIds(styles.find(s=>s.id===value)?.artworkSetIds ?? sets.map(set=>set.id));
  const style = styles.find(s => s.id === value);
  if (style) { setValues({ name: style.name, description: style.description, manufacturerUrl: style.manufacturerUrl, price: (style.unitPriceCents / 100).toFixed(2), cut: style.cut, sizes: style.sizes.map(s => s.label).join(", ") }); setColors(style.colors.map(c => ({ key: c.id, name: c.name, hex: c.hex }))); }
  else { const cut = value.split(":")[1] ?? "classic"; setValues({ ...defaults, cut, name: value ? ({ classic: "Classic Tee", fitted: "Fitted Tee", long: "Long Sleeve" } as Record<string, string>)[cut] : "" }); setColors([{ key: "initial", name: "Band blue", hex: "#1349DF" }]); }
 }
 async function submit(event: FormEvent) {
  event.preventDefault(); setBusy(true); setError(null);
  try {
   const input = { name: values.name, description: values.description, manufacturerUrl: values.manufacturerUrl, unitPriceCents: parseUsd(values.price), cut: values.cut, colors: colors.map(({ name, hex }) => ({ name, hex })), sizes: values.sizes.split(",").map(s => s.trim()).filter(Boolean), artworkSetIds: setIds, ...(styles.some(s => s.id === template) ? { templateStyleId: template } : {}) };
   parseCatalog(createStyleSchema,input);validateColorNames(input.colors);
   const blankPhotos: Array<{colorPosition:number;side:"front"|"back";assetId:string}>=[];
   for(const [colorPosition,color] of colors.entries()) for(const side of ["front","back"] as const) {
    const photo=photos[color.key]?.[side];if(!photo)continue;
    let assetId=stored.current.get(photo.file);
    if(!assetId){assetId=(await uploadImage<{id:string}>(csrfToken,"/api/admin/blank-photos",photo.file)).id;stored.current.set(photo.file,assetId);}
    blankPhotos.push({colorPosition,side,assetId});
   }
   const style = await catalogRequest<CatalogStyle>(csrfToken, `/api/admin/seasons/${seasonId}/catalog`, "POST", {...input,blankPhotos});
   await onCreated(style);
  } catch (e) { setError(e as SeasonError); } finally { setBusy(false); }
 }
 return <Modal title="Add a shirt style" onClose={onClose} busy={busy}><form onSubmit={submit}><fieldset disabled={busy}>
  <label>Start from<select value={template} onChange={e => choose(e.target.value)}><option value="">New custom style</option><optgroup label="Sample styles"><option value="sample:classic">Regular short sleeve</option><option value="sample:fitted">Fitted short sleeve</option><option value="sample:long">Long sleeve</option></optgroup>{!!styles.length && <optgroup label="This season">{styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}</select></label>
  <label>Style name<input autoFocus required maxLength={60} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} /></label>
  <label>Description<input maxLength={160} value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} /></label>
  <label>Manufacturer URL (optional)<input type="url" maxLength={2048} placeholder="https://" value={values.manufacturerUrl} onChange={e => setValues({ ...values, manufacturerUrl: e.target.value })} /></label>
  <div className="form-row"><label>Price ($)<input type="number" min="0" step="0.01" required value={values.price} onChange={e => setValues({ ...values, price: e.target.value })} /></label><label>Sample shirt shape<select value={values.cut} onChange={e => setValues({ ...values, cut: e.target.value })}><option value="classic">Regular short sleeve</option><option value="fitted">Fitted short sleeve</option><option value="long">Long sleeve</option></select></label></div>
  <p className="field-help">The sample shape is a fallback until real blank shirt photos are uploaded.</p>
  <section><h3>Available colors</h3><ColorRows rows={colors} setRows={setColors} /></section>
  <label>Available sizes<input required maxLength={1000} value={values.sizes} onChange={e => setValues({ ...values, sizes: e.target.value })} /></label><p className="field-help">Separate labels with commas, such as Youth S or 4XL. </p>
  <section><h3>Available artwork sets</h3>{sets.map(set=><label className="checkbox-label" key={set.id}><input type="checkbox" checked={setIds.includes(set.id)} onChange={e=>setSetIds(current=>e.target.checked ? [...current,set.id] : current.filter(id=>id!==set.id))} />{set.name}</label>)}<p className="field-help">Select at least one artwork set.</p></section>
  <DraftBlankPhotos colors={colors} photos={photos} onChange={changePhoto} />
  </fieldset><ErrorMessage error={error} /><div className="dialog-actions"><button className="primary" disabled={busy} type="submit">{busy ? "Adding…" : "Add shirt style"}</button><button className="secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
 </form></Modal>;
}
