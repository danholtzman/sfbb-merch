"use client";
import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useBag, type MemberError } from "./BagProvider";
import type { ShopData } from "./member-data";
import { Composite, CompositePreview } from "../artwork/ShirtComposite";
import { cartTotal } from "./cart";
import { formatUsd } from "../../domain/money";
export function CartDrawer({ data, onClose, onCheckout }: { data: ShopData | null; onClose: () => void; onCheckout: () => Promise<void> }) {
 const bag = useBag(); const [busy, setBusy] = useState(false), [error, setError] = useState("");
 function setQuantity(key: string, value: string) { try { bag.dispatch({ type: "SET_QUANTITY", key, quantity: Number(value) }); setError(""); } catch (e) { setError((e as Error).message); } }
 async function checkout() { setBusy(true); setError(""); try { await onCheckout(); } catch (e) { setError((e as MemberError).message); } finally { setBusy(false); } }
 return <Modal title="Your bag" onClose={onClose} busy={busy} className="bag-drawer">
  {bag.state.editing && <p>Editing order <strong>{bag.state.editing.code}</strong></p>}
  {bag.state.preview && <p className="preview-notice">Test bag · Preview only — checkout unavailable</p>}
  <div className="bag-items">{bag.state.lines.map(line => <div className="bag-item" key={line.key}>
   <div className="bag-thumb">{line.originalLineId && bag.state.editing?.previews[line.originalLineId] ? <Composite spec={bag.state.editing.previews[line.originalLineId].front} label={`${line.styleName} front`} /> : <CompositePreview styleId={line.styleId} setId={line.artworkSetId} colorId={line.colorId} side="front" revision={data?.season?.version ?? 0} label={`${line.styleName} front`} />}</div>
   <div className="bag-details"><h3>{line.styleName}</h3><p>{line.artworkSetName}<br />{line.colorName} / {line.sizeLabel} · {formatUsd(line.unitPriceCents)} each</p><div className="bag-quantity"><button aria-label={`Decrease quantity for ${line.styleName}`} disabled={busy || line.quantity <= 1} onClick={() => setQuantity(line.key, String(line.quantity-1))}>−</button><input aria-label={`Quantity for ${line.styleName} ${line.colorName} ${line.sizeLabel}`} type="number" min="1" step="1" max="2147483647" inputMode="numeric" value={line.quantity} disabled={busy} onChange={e => setQuantity(line.key, e.target.value)} /><button aria-label={`Increase quantity for ${line.styleName}`} disabled={busy} onClick={() => setQuantity(line.key, String(line.quantity+1))}>+</button><button className="remove-item" disabled={busy} onClick={() => bag.dispatch({ type: "REMOVE", key: line.key })}>Remove</button></div></div>
  </div>)}</div>
  {!bag.state.lines.length && <p className="empty-state">Your bag is empty.</p>}
  {(error || bag.notice) && <p className="form-error" role="alert">{error || bag.notice}</p>}
  <div className="bag-bottom"><div className="total-line"><span>Total owed</span><strong>{formatUsd(cartTotal(bag.state.lines))}</strong></div><p>You’ll pay the band separately. No payment is taken here.</p><button className="primary wide" disabled={busy || !bag.state.lines.length || bag.state.preview || !data?.open} onClick={checkout}>{busy ? "Checking your bag…" : "Continue to checkout"}</button><button className="text-button wide" disabled={busy} onClick={onClose}>Keep browsing</button></div>
 </Modal>;
}
