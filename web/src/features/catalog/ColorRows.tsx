"use client";
import type { ColorInput } from "./colors";
export type ColorDraft = ColorInput & { key: string };
export function ColorRows({ rows, setRows, orderedColorIds = [] }: { rows: ColorDraft[]; setRows: (rows: ColorDraft[]) => void; orderedColorIds?: string[] }) {
 return <div className="color-editor">{rows.map((row, i) => {
  const used = !!row.id && orderedColorIds.includes(row.id), last = rows.length === 1;
  return <div className="color-editor-row" key={row.key}><label>Color name<input aria-label={`Color name ${i + 1}`} required maxLength={40} value={row.name} onChange={e => setRows(rows.map((r, index) => index === i ? { ...r, name: e.target.value } : r))} /></label>
   <label>Swatch<input aria-label={`Swatch ${i + 1}`} type="color" value={row.hex} onChange={e => setRows(rows.map((r, index) => index === i ? { ...r, hex: e.target.value } : r))} /></label>
   <button type="button" className="secondary" aria-label={`Remove color ${i + 1}`} disabled={used || last} onClick={() => setRows(rows.filter((_, index) => index !== i))}>Remove</button>
   {(used || last) && <p className="color-protection">{used ? "Used by an order, including cancelled orders; cannot be removed." : "Keep at least one color."}</p>}
  </div>;
 })}<button type="button" className="text-button add-color" onClick={() => setRows([...rows, { key: crypto.randomUUID(), name: "", hex: "#1349DF" }])}>+ Add color</button></div>;
}
