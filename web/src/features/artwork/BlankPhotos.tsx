"use client";
import { useState } from "react";
import { useComposite, Composite } from "./ShirtComposite";
import { UploadField, uploadImage } from "./UploadField";
import type { CatalogStyle } from "../catalog/service";
function BlankSlot({ style, colorId, side, csrfToken, run, onSaved }: { style: CatalogStyle; colorId: string; side: "front" | "back"; csrfToken: string; run: (work: () => Promise<void>) => Promise<void>; onSaved: (style: CatalogStyle, message: string) => Promise<void> }) {
 const { spec } = useComposite(style.id, style.artworkSetIds[0], colorId, side, style.version);
 return <div className="blank-photo-slot"><strong>{side.toUpperCase()}{side === "back" ? " (optional)" : ""}</strong>{spec && <Composite spec={{ ...spec, artworkUrl: null }} label={`${side} unprinted blank`} />}<UploadField label={`Upload blank ${side} photo`} accept="image/png,image/jpeg" onFile={file => run(async () => { const updated = await uploadImage<CatalogStyle>(csrfToken, `/api/admin/styles/${style.id}/blank-photos/${side}`, file, style.version, colorId); await onSaved(updated, `${side === "front" ? "Front" : "Back"} blank photo saved`); })} />{spec && !spec.blankUrl && <p className="field-help">Sample blank fallback</p>}</div>;
}
export function BlankPhotos({ style, csrfToken, run, onSaved }: { style: CatalogStyle; csrfToken: string; run: (work: () => Promise<void>) => Promise<void>; onSaved: (style: CatalogStyle, message: string) => Promise<void> }) {
 const [selected, setSelected] = useState(style.colors[0].id), colorId = style.colors.some(c => c.id === selected) ? selected : style.colors[0].id;
 return <section className="blank-photo-stage"><h3>Blank shirt photos</h3><p>Upload unprinted PNG or JPEG shirts, up to 8 MB. Photos are optional; a sample shirt is shown when no photo is uploaded. Season artwork is applied separately.</p>{style.colors.length > 1 && <label>Blank photo color<select value={colorId} onChange={e => setSelected(e.target.value)}>{style.colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<div className="blank-photo-slots">{(["front", "back"] as const).map(side => <BlankSlot key={side} style={style} colorId={colorId} side={side} csrfToken={csrfToken} run={run} onSaved={onSaved} />)}</div></section>;
}
