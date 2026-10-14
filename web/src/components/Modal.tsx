"use client";
import { useEffect, useRef, type ReactNode, type PointerEvent } from "react";
export function Modal({ title, onClose, children, busy = false, className = "" }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const curtainDown = useRef<{ x: number; y: number; pointerId: number; dragged: boolean } | null>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  const outside = (event: PointerEvent<HTMLDialogElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onPointerDown={event => { curtainDown.current = outside(event) ? { x: event.clientX, y: event.clientY, pointerId: event.pointerId, dragged: false } : null; }}
    onPointerMove={event => { const start = curtainDown.current; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) start.dragged = true; }}
    onPointerCancel={() => { curtainDown.current = null; }}
    onPointerUp={event => {
      const start = curtainDown.current; curtainDown.current = null;
      if (start && start.pointerId === event.pointerId && !start.dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6 && outside(event) && !busy) onClose();
    }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}
