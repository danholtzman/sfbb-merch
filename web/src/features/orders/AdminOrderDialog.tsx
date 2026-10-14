"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { parseUsd } from "../../domain/money";
import type { OrderView, AdminOrderLineInput, StyleView } from "../../domain/types";
import type { CatalogSnapshot } from "../catalog/service";
import { catalogRequest } from "../catalog/api";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
import { decimalCents, moneyLabel } from "../reports/rows";
type Row = Omit<AdminOrderLineInput,"quantity"|"unitPriceCents"> & { key: string; quantity: string; price: string };
const originalVariant = (row: Row, order: OrderView) => order.lines.find(l => l.id === row.originalLineId && l.styleId === row.styleId && l.artworkSetId === row.artworkSetId && l.colorId === row.colorId && l.sizeId === row.sizeId);
function newRow(style: StyleView): Row { return { key: crypto.randomUUID(), styleId: style.id, colorId: style.colors[0]?.id ?? "", sizeId: style.sizes[0]?.id ?? "", artworkSetId: style.artworkSetIds[0] ?? "", quantity: "1", price: decimalCents(BigInt(style.unitPriceCents)) }; }
export function AdminOrderDialog({ order, catalog, csrfToken, onClose, onSaved }: { order: OrderView; catalog: CatalogSnapshot; csrfToken: string; onClose: () => void; onSaved: (order: OrderView) => void }) {
 const [name,setName] = useState(order.fullName), [note,setNote] = useState(order.note), [rows,setRows] = useState<Row[]>(order.lines.map(l => ({ key: l.id, originalLineId: l.id, styleId:l.styleId, colorId:l.colorId, sizeId:l.sizeId, artworkSetId:l.artworkSetId, quantity:String(l.quantity), price:decimalCents(BigInt(l.unitPriceCents)) }))), [busy,setBusy] = useState(false), [error,setError] = useState<SeasonError | null>(null);
 function change(key: string, field: keyof Row, value: string) { setRows(current => current.map(row => {
  if (row.key !== key) return row;
  if (field === "styleId") { const style=catalog.styles.find(s=>s.id===value); return style ? { ...newRow(style), key:row.key, originalLineId:row.originalLineId, quantity:row.quantity } : row; }
  const next={...row,[field]:value}, style=catalog.styles.find(s=>s.id===next.styleId);
  if ((field === "colorId" || field === "sizeId") && style && !style.artworkSetIds.includes(next.artworkSetId) && !originalVariant(next,order)) next.artworkSetId=style.artworkSetIds[0] ?? "";
  return next;
 })); }
 function inputs(): AdminOrderLineInput[] {
  if (!rows.length) throw new Error("Add at least one item before saving.");
  return rows.map(row => { const quantity=Number(row.quantity); if (!/^\d+$/.test(row.quantity) || !Number.isInteger(quantity) || quantity<1 || quantity>2147483647) throw new Error("Each quantity must be a positive whole number."); return { styleId:row.styleId,colorId:row.colorId,sizeId:row.sizeId,artworkSetId:row.artworkSetId,quantity,unitPriceCents:parseUsd(row.price),...(row.originalLineId ? {originalLineId:row.originalLineId} : {}) }; });
 }
 let total: string | null = null; try { total=moneyLabel(inputs().reduce((sum,l)=>sum+BigInt(l.quantity)*BigInt(l.unitPriceCents),0n)); } catch { /* Incomplete input is validated on save. */ }
 async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { if (!name.trim()) throw new Error("Enter the member's full name."); const updated=await catalogRequest<OrderView>(csrfToken,`/api/admin/orders/${order.id}`,"PATCH",{fullName:name.trim(),note:note.trim(),expectedVersion:order.version,lines:inputs()}); onSaved(updated); } catch (e) { setError(e as SeasonError); } finally { setBusy(false); } }
 return <Modal title="Edit order" onClose={onClose} busy={busy} className="admin-order-editor"><p>Order <strong>{order.code}</strong> · Changes are saved only when you select Save order.</p><form onSubmit={save}>
  <fieldset disabled={busy}><div className="form-row"><label>Full name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label><label>Member note<textarea maxLength={2000} rows={2} value={note} onChange={e=>setNote(e.target.value)} /></label></div>
  <div className="admin-edit-items">{rows.map((row,index) => { const style=catalog.styles.find(s=>s.id===row.styleId), original=originalVariant(row,order), sets=style?.artworkSetIds ?? [], missingSet=original && !sets.includes(original.artworkSetId); return <section className="admin-edit-item" key={row.key} aria-label={`Item ${index+1}`}><div className="edit-item-heading"><h3>Item {index+1}</h3><button type="button" className="text-button" onClick={()=>setRows(current=>current.filter(r=>r.key!==row.key))}>Remove item</button></div>
   <div className="edit-variant-fields"><label>Shirt style<select required value={row.styleId} onChange={e=>change(row.key,"styleId",e.target.value)}>{catalog.styles.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Color<select required value={row.colorId} onChange={e=>change(row.key,"colorId",e.target.value)}>{style?.colors.map(c=><option value={c.id} key={c.id}>{original?.colorId===c.id ? original.colorName+" (ordered)" : c.name}</option>)}</select></label><label>Size<select required value={row.sizeId} onChange={e=>change(row.key,"sizeId",e.target.value)}>{style?.sizes.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select></label>
   {(sets.length>1 || missingSet) && <label>Artwork set<select required value={row.artworkSetId} onChange={e=>change(row.key,"artworkSetId",e.target.value)}>{sets.map(id=><option value={id} key={id}>{catalog.artworkSets.find(s=>s.id===id)?.name}</option>)}{missingSet && <option value={original.artworkSetId}>{original.artworkSetName} (ordered)</option>}</select></label>}
   <label>Quantity<input type="number" min="1" max="2147483647" step="1" inputMode="numeric" required value={row.quantity} onChange={e=>change(row.key,"quantity",e.target.value)} /></label><label>Unit price ($)<input inputMode="decimal" required value={row.price} onChange={e=>change(row.key,"price",e.target.value)} /></label></div>
   {original && <p className="field-help">Unchanged variants retain their ordered descriptions and color. Unit price is an explicit admin override.</p>}
  </section>; })}</div>
  {!rows.length && <p>Add at least one item before saving.</p>}<button type="button" className="secondary" disabled={rows.length>=100 || !catalog.styles.length} onClick={()=>setRows(current=>[...current,newRow(catalog.styles[0])])}>+ Add item</button>
  </fieldset><ErrorMessage error={error} />{error?.code === "STALE_VERSION" && <p>Your unsaved inputs are still here. Discard changes and reopen the latest order before saving.</p>}
  {total && <p className="editor-total"><strong>Item total: {total}</strong>{order.cancelled || order.progress === "COMPLETE" ? " · Amount owed remains $0.00." : ""}</p>}
  <div className="dialog-actions"><button className="primary" type="submit" disabled={busy || !rows.length}>{busy?"Saving…":"Save order"}</button><button className="secondary" type="button" onClick={onClose} disabled={busy}>Discard changes</button></div>
 </form></Modal>;
}
