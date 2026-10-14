"use client";
import { useEffect, useState } from "react";
import { formatUsd } from "../../domain/money";
import type { ArtworkSetView } from "../../domain/types";
import type { CatalogStyle, CatalogSnapshot } from "./service";
import { catalogRequest, notifyCatalogChange } from "./api";
import { CreateStyleDialog } from "./CreateStyleDialog";
import { StyleDialog } from "./StyleDialog";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
function StylePreview({ style, sets }: { style: CatalogStyle; sets: ArtworkSetView[] }) {
 const [colorId, setColorId] = useState(style.colors[0]?.id), [setId, setSetId] = useState(style.artworkSetIds[0]);
 const color = style.colors.find(c => c.id === colorId) ?? style.colors[0];
 const available = sets.filter(s => style.artworkSetIds.includes(s.id));
 const selected = available.find(s => s.id === setId) ?? available[0];
 const shape = style.cut === "long" ? "M90 35 L125 20 Q160 43 195 20 L230 35 L275 245 L245 253 L218 113 L215 275 Q160 284 105 275 L102 113 L75 253 L45 245 Z" : style.cut === "fitted" ? "M80 48 L125 20 Q160 43 195 20 L240 48 L263 77 L234 107 L207 83 Q197 170 212 275 Q160 284 108 275 Q123 170 113 83 L86 107 L57 77 Z" : "M80 48 L125 20 Q160 43 195 20 L240 48 L265 80 L235 109 L210 83 L210 275 Q160 284 110 275 L110 83 L85 109 L55 80 Z";
 return <><div className="preview-selectors"><label>Preview color<select value={color?.id ?? ""} onChange={e => setColorId(e.target.value)}>{style.colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{available.length > 1 && <label>Preview artwork set<select value={selected?.id ?? ""} onChange={e => setSetId(e.target.value)}>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}</div>
  <div className="style-previews">{(["front", "back"] as const).map(side => <div className="style-preview" key={side}><svg viewBox="0 0 320 310" role="img" aria-label={`${style.name}, ${color?.name}, sample ${side} blank`}><path d={shape} fill={color?.hex ?? "#1349DF"} /><path d="M125 20 Q160 65 195 20" fill="none" stroke="#000" opacity=".15" strokeWidth="5" /></svg><div className="preview-caption"><strong>{side.toUpperCase()}</strong><span>{selected?.[side === "front" ? "frontAssetId" : "backAssetId"] ? "Artwork preview arrives in Stage 6" : `${side === "front" ? "Front" : "Back"} artwork not uploaded`}</span></div></div>)}</div>
 </>;
}
export function StyleList({ seasonId, csrfToken, onCatalogChanged }: { seasonId: string; csrfToken: string; onCatalogChanged: () => Promise<unknown> }) {
 const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null), [error, setError] = useState<SeasonError | null>(null), [dialog, setDialog] = useState<string | null>(null);
 useEffect(() => { let active = true; catalogRequest<CatalogSnapshot>(csrfToken, `/api/admin/seasons/${seasonId}/catalog`).then(data => { if (active) setCatalog(data); }).catch(e => { if (active) setError(e); }); return () => { active = false; }; }, [seasonId, csrfToken]);
 async function updated(style: CatalogStyle) {
  setCatalog(previous => previous && { ...previous, styles: previous.styles.map(s => s.id === style.id ? style : s) });
  notifyCatalogChange({ seasonId, styleId: style.id, removedColorIds: style.removedColorIds, removedSetIds: style.removedSetIds });
  await onCatalogChanged();
 }
 async function created(style: CatalogStyle) { setCatalog(previous => previous && { ...previous, styles: [...previous.styles, style] }); setDialog(style.id); await onCatalogChanged(); }
 async function deleted(id: string) { setCatalog(previous => previous && { ...previous, styles: previous.styles.filter(s => s.id !== id) }); notifyCatalogChange({ seasonId, styleId: id, deletedStyleId: id }); setDialog(null); await onCatalogChanged(); }
 const editing = catalog?.styles.find(s => s.id === dialog);
 return <section className="merchandise-panel"><div className="merch-toolbar"><button className="primary" disabled title="Artwork management arrives in Stage 6">Manage artwork</button><button className="primary" disabled={!catalog} onClick={() => setDialog("new")}>+ Add shirt style</button></div><ErrorMessage error={error} />
  {!catalog ? <p>Loading merchandise…</p> : !catalog.styles.length ? <p>No shirt styles yet. Add a shirt style to start this collection.</p> : <div className="style-list">{catalog.styles.map(style => <article className="style-section" key={style.id}><div className="style-heading"><h3>{style.name}</h3><strong>{formatUsd(style.unitPriceCents)}</strong><button className="secondary" onClick={() => setDialog(style.id)}>Manage style</button></div>{style.description && <p>{style.description}</p>}<p>{style.colors.map(c => c.name).join(" · ")} / {style.sizes.map(s => s.label).join(" · ")}</p><StylePreview style={style} sets={catalog.artworkSets} /></article>)}</div>}
  {dialog === "new" && catalog && <CreateStyleDialog styles={catalog.styles} seasonId={seasonId} csrfToken={csrfToken} onClose={() => setDialog(null)} onCreated={created} />}
  {editing && catalog && <StyleDialog key={editing.id} style={editing} sets={catalog.artworkSets} csrfToken={csrfToken} onClose={() => setDialog(null)} onUpdated={updated} onDeleted={deleted} />}
 </section>;
}
