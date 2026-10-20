"use client";
/* eslint-disable @next/next/no-img-element -- Local file previews use temporary browser object URLs. */
import { useState } from "react";
import { UploadField } from "../artwork/UploadField";
import type { ColorDraft } from "./ColorRows";
export type DraftPhoto = { file: File; url: string };
export type DraftPhotos = Record<string, Partial<Record<"front" | "back", DraftPhoto>>>;
export function DraftBlankPhotos({ colors, photos, onChange }: { colors: ColorDraft[]; photos: DraftPhotos; onChange: (key: string, side: "front" | "back", file: File | null) => void }) {
 const [selected, setSelected] = useState(colors[0]?.key ?? "");
 const color = colors.find(c => c.key === selected) ?? colors[0];
 return <section className="blank-photo-stage"><h3>Blank shirt photos</h3><p className="field-help">Optional unprinted PNG or JPEG shirts, up to 8 MB per image. Choose photos for each color; they save when you add the style. Season artwork is applied separately.</p>
  {colors.length > 1 && <label>Blank photo color<select value={color?.key ?? ""} onChange={e => setSelected(e.target.value)}>{colors.map(c => <option key={c.key} value={c.key}>{c.name || "Unnamed color"}</option>)}</select></label>}
  {color && <div className="blank-photo-slots">{(["front", "back"] as const).map(side => { const photo=photos[color.key]?.[side];return <div className="blank-photo-slot" key={`${color.key}:${side}`}><strong>{side.toUpperCase()}{side === "back" ? " (optional)" : ""}</strong>{photo ? <img className="draft-blank-image" src={photo.url} alt={`${side} shirt photo to upload`} /> : <div className="empty-upload">Sample shirt will be used</div>}<UploadField label={`Upload blank ${side} photo`} accept="image/png,image/jpeg" onFile={async file => onChange(color.key,side,file)} />{photo && <><p className="field-help">{photo.file.name}</p><button type="button" className="text-button" onClick={()=>onChange(color.key,side,null)}>Remove {side} photo</button></>}</div>;})}</div>}
 </section>;
}
