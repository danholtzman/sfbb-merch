"use client";
import type { OrderView, Progress } from "../domain/types";
export function StatusControl({ order, disabled, onChange }: { order: OrderView; disabled: boolean; onChange: (progress: Progress) => void }) {
 return order.cancelled ? <span className="status-badge status-cancelled">Cancelled</span> : <select className="order-status-control" aria-label={`Order status for ${order.fullName}`} value={order.progress} disabled={disabled} onChange={e => onChange(e.target.value as Progress)}><option value="OPEN">Open</option><option value="DELIVERED_UNPAID">Delivered · unpaid</option><option value="COMPLETE">Complete</option></select>;
}
