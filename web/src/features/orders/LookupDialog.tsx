"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import { useBag, type MemberError } from "./BagProvider";
import { normalizeCode } from "./code-format";
import type { MemberOrder } from "./member-data";
export function LookupDialog({ onClose }: { onClose: () => void }) {
 const bag = useBag(); const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
 async function lookup(event: FormEvent) { event.preventDefault(); const normalized = normalizeCode(code); if (!normalized) { setError("Enter the six-character code from your confirmation."); return; } setBusy(true); setError(""); try { const order = await bag.request<MemberOrder>("/api/orders/lookup", "POST", { code: normalized }); onClose(); bag.showOrder(order); } catch (e) { setError((e as MemberError).message); } finally { setBusy(false); } }
 return <Modal title="Find my order" onClose={onClose} busy={busy}><p>Enter the six-character code you received at checkout.</p><form onSubmit={lookup}><label>Order code<input autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8} value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. BR4SS2" disabled={busy} className="lookup-code" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary wide" disabled={busy} type="submit">{busy ? "Looking up…" : "Look up order"}</button></form></Modal>;
}
export function FindOrder() { const [open, setOpen] = useState(true); return <><h1>Find my order</h1><p>Your confirmation code is all you need.</p><button className="primary" onClick={() => setOpen(true)}>Look up an order</button>{open && <LookupDialog onClose={() => setOpen(false)} />}</>; }
