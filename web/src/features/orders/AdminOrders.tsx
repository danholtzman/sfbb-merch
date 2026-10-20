"use client";
import { useEffect, useState } from "react";
import type { OrderView, SeasonView, Progress } from "../../domain/types";
import { Modal } from "../../components/Modal";
import { StatusControl } from "../../components/StatusControl";
import { catalogRequest } from "../catalog/api";
import type { CatalogSnapshot } from "../catalog/service";
import { ErrorMessage, type SeasonError } from "../seasons/SeasonDialog";
import { dashboardMetrics, moneyLabel, type Report } from "../reports/rows";
import { formatUsd } from "../../domain/money";
import { OrderSummary } from "./CheckoutDialog";
import { orderStatus } from "./OrderDetailsDialog";
import { AdminOrderDialog } from "./AdminOrderDialog";
export function AdminOrders({ season, csrfToken, onOrdersChanged }: { season: SeasonView; csrfToken: string; onOrdersChanged: () => Promise<unknown> }) {
 const [orders,setOrders] = useState<OrderView[] | null>(null), [catalog,setCatalog] = useState<CatalogSnapshot | null>(null), [search,setSearch] = useState(""), [error,setError] = useState<SeasonError | null>(null), [busy,setBusy] = useState<string | null>(null), [exporting,setExporting] = useState<Report | null>(null), [dialog,setDialog] = useState<{ mode:"view"|"edit"|"cancel"; order:OrderView } | null>(null);
 useEffect(()=>{ let active=true; Promise.all([catalogRequest<OrderView[]>(csrfToken,`/api/admin/orders?seasonId=${season.id}`),catalogRequest<CatalogSnapshot>(csrfToken,`/api/admin/seasons/${season.id}/catalog`)]).then(([rows,styles])=>{if(active){setOrders(rows);setCatalog(styles);}}).catch(e=>{if(active)setError(e);}); return ()=>{active=false;}; },[season.id,csrfToken]);
 async function refresh() { const rows=await catalogRequest<OrderView[]>(csrfToken,`/api/admin/orders?seasonId=${season.id}`); setOrders(rows); }
 function apply(order: OrderView) { setOrders(current=>current?.map(o=>o.id===order.id ? order : o) ?? null); void onOrdersChanged().catch(e=>setError(e)); }
 async function progress(order: OrderView, value: Progress) { setBusy(order.id);setError(null); try { const updated=await catalogRequest<OrderView>(csrfToken,`/api/admin/orders/${order.id}/progress`,"PATCH",{expectedVersion:order.version,progress:value});apply(updated); } catch(e) {setError(e as SeasonError);try{await refresh();}catch{/* Keep the version-conflict explanation. */}} finally{setBusy(null);} }
 async function cancelRestore(order: OrderView, operation: "cancel"|"restore") { setBusy(order.id);setError(null); try { const updated=await catalogRequest<OrderView>(csrfToken,`/api/admin/orders/${order.id}/${operation}`,"POST",{expectedVersion:order.version});apply(updated);setDialog({mode:"view",order:updated}); } catch(e){setError(e as SeasonError);}finally{setBusy(null);} }
 async function edit(order: OrderView) { setBusy(order.id);setError(null);try { const current=await catalogRequest<CatalogSnapshot>(csrfToken,`/api/admin/seasons/${season.id}/catalog`);setCatalog(current);setDialog({mode:"edit",order}); }catch(e){setError(e as SeasonError);}finally{setBusy(null);} }
 async function download(report: Report) { setExporting(report);setError(null);try {
  const response=await fetch(`/api/admin/reports/${report}?${new URLSearchParams({seasonId:season.id})}`,{cache:"no-store"}); if(!response.ok)throw (await response.json()).error;
  const blob=await response.blob(), url=URL.createObjectURL(blob), link=document.createElement("a"), disposition=response.headers.get("Content-Disposition") ?? "";
  link.href=url;link.download=/filename="([^"]+)"/.exec(disposition)?.[1] ?? "sfbb-report.csv";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError(e instanceof Error ? {message:"Unable to download the report. Please try again."} : e as SeasonError);}finally{setExporting(null);} }
 const metrics=dashboardMetrics(orders ?? []), needle=search.normalize("NFKC").trim().toLowerCase(), visible=orders?.filter(o=>o.fullName.normalize("NFKC").toLowerCase().includes(needle)||o.code.toLowerCase().includes(needle));
 return <section className="orders-dashboard">
  <div className="order-stats"><article><span>ACTIVE ORDERS</span><strong data-testid="active-orders">{orders ? metrics.activeOrders : "—"}</strong><small>{season.name}</small></article><article><span>ITEMS TO FULFILL</span><strong data-testid="items-to-fulfill">{orders ? metrics.itemsToFulfill.toLocaleString("en-US") : "—"}</strong><small>Open orders only</small></article><article><span>TOTAL OWED</span><strong data-testid="total-owed">{orders ? moneyLabel(metrics.amountOwedCents) : "—"}</strong><small>Collected separately by the band</small></article></div>
  <div className="order-exports" aria-busy={exporting!==null}>{([
   ["billing","Billing CSV","One row per order: full name, order code, shirt total, amount owed, comments, and a blank Paid? checklist. Excludes cancelled orders."],
   ["member-delivery","Fulfillment by customer CSV","Shirt variants grouped by customer, with quantities and a blank Fulfilled checklist."],
   ["product-delivery","Fulfillment by product CSV","Quantities grouped by shirt style and artwork set, sorted by color and size, with a blank Fulfilled checklist."],
   ["manufacturer-order","T-shirt ordering CSV","Total quantities per shirt variant, with a blank Ordered? checklist. Excludes cancelled orders."]
  ] as const).map(([report,label,description])=><div key={report}><button className="secondary" aria-busy={exporting===report} disabled={exporting!==null || !orders} onClick={()=>void download(report)}>↓ {label}</button><p>{description}</p></div>)}</div>
  <div className="table-toolbar"><h2>Member orders</h2><input aria-label="Search orders" placeholder="Search member or order code" maxLength={128} value={search} onChange={e=>setSearch(e.target.value)} /></div>
  {!dialog && <ErrorMessage error={error} />}
  <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>MEMBER / ORDER</th><th>ITEMS</th><th>AMOUNT OWED</th><th>STATUS</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{visible?.map(order=><tr key={order.id}><td><strong>{order.fullName}</strong><small>{order.code}</small></td><td>{order.lines.reduce((sum,l)=>sum+l.quantity,0)} items<small>{order.lines.map(l=>`${l.styleName} · ${l.artworkSetName} · ${l.colorName} / ${l.sizeLabel}`).join(", ")}</small></td><td><strong>{formatUsd(order.amountOwedCents)}</strong></td><td><StatusControl order={order} disabled={busy!==null} onChange={value=>void progress(order,value)} /></td><td><button className="secondary view-order" disabled={busy!==null} onClick={()=>{setError(null);setDialog({mode:"view",order});}}>View ↗</button></td></tr>)}{!visible?.length && <tr><td colSpan={5}>{orders ? "No matching orders in this season." : error ? "Unable to load orders." : "Loading orders…"}</td></tr>}</tbody></table></div>
  {dialog && dialog.mode==="edit" && catalog ? <AdminOrderDialog order={dialog.order} catalog={catalog} csrfToken={csrfToken} onClose={()=>{setDialog(null);setError(null);void refresh().catch(e=>setError(e));}} onSaved={updated=>{apply(updated);setDialog(null);setError(null);}} /> : dialog && <Modal title={dialog.mode==="cancel" ? "Cancel this order?" : `${dialog.order.fullName}’s order`} busy={busy!==null} onClose={()=>{setDialog(null);setError(null);}}>
   {dialog.mode==="cancel" ? <><p>Cancel order {dialog.order.code} for {dialog.order.fullName}? Its items will be excluded from fulfillment and billing. The saved order can be restored.</p><ErrorMessage error={error} /><button className="danger wide" disabled={busy!==null} onClick={()=>void cancelRestore(dialog.order,"cancel")}>Yes, cancel order {dialog.order.code}</button><button className="text-button wide" disabled={busy!==null} onClick={()=>setDialog({...dialog,mode:"view"})}>Keep order</button></> : <>
    <p>Order <strong>{dialog.order.code}</strong> · <span className="status-badge">{orderStatus(dialog.order)}</span></p><OrderSummary lines={dialog.order.lines} amount={dialog.order.amountOwedCents} /><h3>Member note</h3><p className="member-note">{dialog.order.note || "No note"}</p><p>{season.name}</p><p>Admins can edit or cancel orders even after ordering closes.</p><ErrorMessage error={error} />
    <div className="dialog-actions">{dialog.order.cancelled ? <button className="primary" disabled={busy!==null} onClick={()=>void cancelRestore(dialog.order,"restore")}>Restore order</button> : <><button className="primary" disabled={busy!==null} onClick={()=>void edit(dialog.order)}>Edit order</button><button className="danger" disabled={busy!==null} onClick={()=>setDialog({...dialog,mode:"cancel"})}>Cancel order</button></>}</div>
   </>}
  </Modal>}
 </section>;
}
