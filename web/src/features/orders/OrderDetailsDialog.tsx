"use client";
import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useBag, type MemberError } from "./BagProvider";
import type { MemberOrder } from "./member-data";
import { OrderSummary } from "./CheckoutDialog";
import { displayDate } from "./Shop";
export const orderStatus = (order: { cancelled: boolean; progress: string }) => order.cancelled ? "Cancelled" : order.progress === "COMPLETE" ? "Complete" : order.progress === "DELIVERED_UNPAID" ? "Delivered · unpaid" : "Open";
export function OrderDetailsDialog({ order, onClose, onChanged, onEdit }: { order: MemberOrder; onClose: () => void; onChanged: (order: MemberOrder) => void; onEdit: (order: MemberOrder) => void }) {
 const bag = useBag(); const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
 async function mutate(operation: "cancel" | "restore") { setBusy(true); setError(""); try { await bag.request(`/api/orders/${order.code}/${operation}`, "POST", { expectedVersion: order.version }); const latest = await bag.request<MemberOrder>("/api/orders/lookup", "POST", { code: order.code }); setConfirm(false); onChanged(latest); } catch (e) { setError((e as MemberError).message); } finally { setBusy(false); } }
 return <Modal title={confirm ? "Cancel this order?" : `${order.fullName}’s order`} onClose={onClose} busy={busy}>
  {confirm ? <><p>{order.fullName}, order {order.code} will be removed from fulfillment and billing. You can restore it while this season is open and the order remains Open.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="danger wide" disabled={busy} onClick={() => void mutate("cancel")}>Yes, cancel order {order.code}</button><button className="text-button wide" disabled={busy} onClick={() => { setConfirm(false); setError(""); }}>Keep my order</button></> : <>
   <p>Order <strong>{order.code}</strong> · <span className="status-badge">{orderStatus(order)}</span></p><OrderSummary lines={order.lines} amount={order.amountOwedCents} />
   <h3>Member note</h3><p className="member-note">{order.note || "No note"}</p><p>{order.season.name}</p>
   {order.canEdit ? <p>You can make changes through {displayDate(order.season.closesOn)} (San Francisco time).</p> : <p>Changes are locked because ordering has closed or your order has progressed. Contact the admin for help.</p>}
   {error && <p className="form-error" role="alert">{error}</p>}
   {order.canEdit && <div className="dialog-actions">{order.cancelled ? <button className="primary" disabled={busy} onClick={() => void mutate("restore")}>Restore order</button> : <><button className="primary" onClick={() => onEdit(order)}>Edit order</button><button className="danger" onClick={() => setConfirm(true)}>Cancel order</button></>}</div>}
  </>}
 </Modal>;
}
