"use client";
import { useEffect, useState } from "react";
import { PlacementEditor, type PlacementTarget } from "../artwork/PlacementEditor";
import { notifyPreviewChange } from "../artwork/preview-events";
import { ArtworkDialog } from "../artwork/ArtworkDialog";
import { CompositePreview } from "../artwork/ShirtComposite";
import { formatUsd } from "../../domain/money";
import type { ArtworkSetView } from "../../domain/types";
import type { CatalogStyle, CatalogSnapshot } from "./service";
import { catalogRequest, notifyCatalogChange } from "./api";
import { CreateStyleDialog } from "./CreateStyleDialog";
import { StyleDialog } from "./StyleDialog";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
function StylePreview({ style, sets, revision, choice, onChoice, onEdit }: { style: CatalogStyle; sets: ArtworkSetView[]; revision: number; choice?: {colorId:string;setId:string}; onChoice:(choice:{colorId:string;setId:string})=>void; onEdit:(target:PlacementTarget)=>void }) {
 const colorId=choice?.colorId ?? style.colors[0]?.id, setId=choice?.setId ?? style.artworkSetIds[0];
 const color = style.colors.find(c => c.id === colorId) ?? style.colors[0];
 const available = sets.filter(s => style.artworkSetIds.includes(s.id));
 const selected = available.find(s => s.id === setId) ?? available[0];
 return <><div className="preview-selectors">{style.colors.length > 1 && <label>Preview color<select value={color?.id ?? ""} onChange={e => onChoice({colorId:e.target.value,setId:selected?.id ?? ""})}>{style.colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{available.length > 1 && <label>Preview artwork set<select value={selected?.id ?? ""} onChange={e => onChoice({colorId:color?.id ?? "",setId:e.target.value})}>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}</div>
  <div className="style-previews">{(color && style.backPhotoColorIds?.includes(color.id) ? ["front", "back"] as const : ["front"] as const).map(side => <div className="style-preview" key={side}>{selected && color && <button className="preview-open" aria-label={`Edit ${side} preview for ${style.name}`} onClick={()=>onEdit({styleId:style.id,setId:selected.id,colorId:color.id,side})}><CompositePreview styleId={style.id} setId={selected.id} colorId={color.id} side={side} revision={revision + style.version} label={`${style.name}, ${color.name}, ${side}`} /></button>}<div className="preview-caption"><strong>{side.toUpperCase()}</strong>{selected && color && <button className="preview-edit" aria-label={`Edit ${side} placement for ${style.name}`} onClick={()=>onEdit({styleId:style.id,setId:selected.id,colorId:color.id,side})}>Edit ↗</button>}<span>{selected?.[side === "front" ? "frontAssetId" : "backAssetId"] ? "" : `${side === "front" ? "Front" : "Back"} artwork not uploaded`}</span></div></div>)}</div>
 </>;
}
export function StyleList({ seasonId, csrfToken, onCatalogChanged }: { seasonId: string; csrfToken: string; onCatalogChanged: () => Promise<unknown> }) {
 const [placement,setPlacement]=useState<PlacementTarget | null>(null), [choices,setChoices]=useState<Record<string,{colorId:string;setId:string}>>({});
 const [revision, setRevision] = useState(0);
 const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null), [error, setError] = useState<SeasonError | null>(null), [dialog, setDialog] = useState<string | null>(null);
 useEffect(() => { let active = true; catalogRequest<CatalogSnapshot>(csrfToken, `/api/admin/seasons/${seasonId}/catalog`).then(data => { if (active) setCatalog(data); }).catch(e => { if (active) setError(e); }); return () => { active = false; }; }, [seasonId, csrfToken]);
 async function refreshArtwork() {
  const next = await catalogRequest<CatalogSnapshot>(csrfToken, `/api/admin/seasons/${seasonId}/catalog`);
  setCatalog(next); notifyPreviewChange({}); setRevision(r => r + 1); await onCatalogChanged();
 }
 async function updated(style: CatalogStyle) {
  setCatalog(previous => previous && { ...previous, styles: previous.styles.map(s => s.id === style.id ? style : s) });
  notifyPreviewChange({styleId:style.id});
  notifyCatalogChange({ seasonId, styleId: style.id, removedColorIds: style.removedColorIds, removedSetIds: style.removedSetIds });
  await onCatalogChanged();
 }
 async function created(style: CatalogStyle) { setCatalog(previous => previous && { ...previous, styles: [...previous.styles, style] }); setDialog(null); await onCatalogChanged(); }
 async function deleted(id: string) { setCatalog(previous => previous && { ...previous, styles: previous.styles.filter(s => s.id !== id) }); notifyCatalogChange({ seasonId, styleId: id, deletedStyleId: id }); setDialog(null); await onCatalogChanged(); }
 const editing = catalog?.styles.find(s => s.id === dialog);
 return <section className="merchandise-panel"><div className="merch-toolbar"><button className="primary" disabled={!catalog} onClick={() => setDialog("artwork")}>Manage artwork</button><button className="primary" disabled={!catalog} onClick={() => setDialog("new")}>+ Add shirt style</button></div><ErrorMessage error={error} />
  {!catalog ? <p>Loading merchandise…</p> : !catalog.styles.length ? <p>No shirt styles yet. Add a shirt style to start this collection.</p> : <div className="style-list">{catalog.styles.map(style => <article className="style-section" key={style.id}><div className="style-heading"><h3>{style.name}</h3><strong>{formatUsd(style.unitPriceCents)}</strong><button className="secondary" onClick={() => setDialog(style.id)}>Manage style</button></div>{style.description && <p>{style.description}</p>}{style.manufacturerUrl && <p><a href={style.manufacturerUrl} target="_blank" rel="noopener noreferrer">View manufacturer details ↗</a></p>}<p>{style.colors.map(c => c.name).join(" · ")} / {style.sizes.map(s => s.label).join(" · ")}</p><StylePreview style={style} sets={catalog.artworkSets} revision={revision} choice={choices[style.id]} onChoice={choice=>setChoices(previous=>({...previous,[style.id]:choice}))} onEdit={setPlacement} /></article>)}</div>}
  {placement && catalog?.styles.find(s=>s.id===placement.styleId) && <PlacementEditor style={catalog.styles.find(s=>s.id===placement.styleId)!} sets={catalog.artworkSets} initial={placement} csrfToken={csrfToken} onClose={()=>setPlacement(null)} onSaved={target=>{setChoices(previous=>({...previous,[target.styleId]:{colorId:target.colorId,setId:target.setId}}));setPlacement(null);void refreshArtwork().catch(e=>setError(e));}} />}
  {dialog === "artwork" && catalog && <ArtworkDialog sets={catalog.artworkSets} seasonId={seasonId} csrfToken={csrfToken} onClose={() => setDialog(null)} onChanged={refreshArtwork} />}
  {dialog === "new" && catalog && <CreateStyleDialog styles={catalog.styles} sets={catalog.artworkSets} seasonId={seasonId} csrfToken={csrfToken} onClose={() => setDialog(null)} onCreated={created} />}
  {editing && catalog && <StyleDialog key={editing.id} style={editing} sets={catalog.artworkSets} csrfToken={csrfToken} onClose={() => setDialog(null)} onUpdated={updated} onDeleted={deleted} />}
 </section>;
}
