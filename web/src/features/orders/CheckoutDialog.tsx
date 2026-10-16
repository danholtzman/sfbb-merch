"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import type { OrderView, SeasonView } from "../../domain/types";
import type { ShopData } from "./member-data";
import { useBag, type MemberError } from "./BagProvider";
import { formatUsd } from "../../domain/money";
import { cartTotal } from "./cart";
import { displayDate } from "./Shop";
export function OrderSummary({ lines, amount }: { lines: Array<{ styleName: string; artworkSetName: string; colorName: string; sizeLabel: string; quantity: number; unitPriceCents: number }>; amount: number }) {
 return <div className="checkout-summary">{lines.map((l, i) => <div key={i}><span>{l.quantity} × {l.styleName}<small>{l.artworkSetName} · {l.colorName} / {l.sizeLabel}</small></span><strong>{formatUsd(l.quantity*l.unitPriceCents)}</strong></div>)}<div className="total-line"><strong>Total owed</strong><strong>{formatUsd(amount)}</strong></div></div>;
}
export function CheckoutDialog({ catalog, onClose, getKey, onCatalogChanged, onSaved }: { catalog: ShopData; onClose: () => void; getKey: (input: unknown) => Promise<string>; onCatalogChanged: () => Promise<unknown>; onSaved: (order: OrderView) => void }) {
 const bag = useBag(), editing = bag.state.editing;
 const [name, setName] = useState(editing?.fullName ?? ""), [note, setNote] = useState(editing?.note ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState<MemberError | null>(null), [reviewNeeded, setReviewNeeded] = useState(false);
 const [email, setEmail] = useState("");
 async function submit(event: FormEvent) {
  event.preventDefault(); setBusy(true); setError(null);
  const input = { fullName: name.trim(), note: note.trim(), lines: bag.state.lines.map(l => ({ styleId: l.styleId, artworkSetId: l.artworkSetId, colorId: l.colorId, sizeId: l.sizeId, quantity: l.quantity, ...(editing && l.originalLineId ? { originalLineId: l.originalLineId } : {}) })) };
  try {
   const payload = editing ? { ...input, expectedVersion: editing.version } : { ...input, seasonId: bag.state.seasonId, ...(catalog.confirmationEmailsEnabled && email.trim() ? { confirmationEmail: email.trim() } : {}) };
   const order = await bag.request<OrderView>(editing ? `/api/orders/${editing.code}` : "/api/orders", editing ? "PATCH" : "POST", payload, { "X-SFBB-Catalog-Version": String(catalog.season!.version), ...(editing ? {} : { "Idempotency-Key": await getKey(payload) }) }); onSaved(order);
  } catch (e) { const failure = e as MemberError; setError(failure); if (failure.code === "CATALOG_CHANGED") { setReviewNeeded(true); try { await onCatalogChanged(); } catch { /* Keep inputs and the original error; retry from the bag. */ } } }
  finally { setBusy(false); }
 }
 return <Modal title="Checkout" onClose={onClose} busy={busy}>
  <p>{editing ? `Save changes to order ${editing.code}.` : "One order, all your season picks."} You’ll pay the band separately.</p>
  <OrderSummary lines={bag.state.lines} amount={cartTotal(bag.state.lines)} />
  <form onSubmit={submit}><fieldset disabled={busy}><label>Full name<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label><label>Member note<textarea maxLength={2000} rows={3} placeholder="Optional" value={note} onChange={e => setNote(e.target.value)} /></label>
   {!editing && catalog.confirmationEmailsEnabled && <><label>Confirmation email (optional)<input type="email" maxLength={254} autoComplete="email" aria-describedby="confirmation-email-help" value={email} onChange={e => setEmail(e.target.value)} /></label><p className="field-help" id="confirmation-email-help">Enter an address to request one confirmation email. Delivery is best effort; save your order code on the next screen.</p></>}
  </fieldset>
   {error && <p role="alert" className="form-error">{error.message}{error.code === "STALE_VERSION" && " Your unsaved inputs are still here. Close this dialog and look up the order again to review the latest version."}</p>}
   {reviewNeeded ? <button type="button" className="secondary wide" disabled={busy} onClick={() => { onClose(); bag.openBag(); }}>Review updated bag</button> : <button type="submit" className="primary wide" disabled={busy || !name.trim() || !bag.state.lines.length || !catalog.open || catalog.preview}>{busy ? "Saving…" : editing ? "Save order changes" : "Place order"}</button>}
   <button type="button" className="text-button wide" disabled={busy} onClick={onClose}>Keep browsing</button>
  </form>
 </Modal>;
}
export function ConfirmationDialog({ order, season, onClose }: { order: OrderView; season: SeasonView; onClose: () => void }) {
 const [copy, setCopy] = useState("");
 async function copyCode() { try { await navigator.clipboard.writeText(order.code); setCopy("Copied!"); } catch { setCopy("Copy unavailable. Select and save the code shown above."); } }
 return <Modal title="You're on the list." onClose={onClose}>
  <p>Save this code to find your order later.</p><div className="order-code" data-testid="order-code">{order.code}</div><button className="secondary wide" onClick={copyCode}>Copy order code</button><p role="status">{copy}</p>
  <OrderSummary lines={order.lines} amount={order.amountOwedCents} /><p>Pay the band separately. No payment was collected.</p><p>You can edit or cancel an Open order through {displayDate(season.closesOn)} (San Francisco time). Contact the admin if you lose your code.</p><button className="primary wide" onClick={onClose}>Return to shop</button>
 </Modal>;
}
