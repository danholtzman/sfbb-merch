"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cartReducer, restoreCart, bagSignature, type CartState, type CartAction } from "./cart-state";
import type { MemberOrder, ShopData } from "./member-data";
import type { OrderView, SeasonView } from "../../domain/types";
import { CartDrawer } from "./CartDrawer";
import { CheckoutDialog, ConfirmationDialog } from "./CheckoutDialog";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { affectsPreview, subscribePreviewChanges } from "../artwork/preview-events";
export type MemberError = { message: string; code?: string };
const empty: CartState = { seasonId: "", preview: false, lines: [], editing: null };
type BagContext = { state: CartState; data: ShopData | null; ready: boolean; sessionId: string; notice: string; csrfToken: string; dispatch: (action: CartAction) => void; configure: (catalog: ShopData) => void; openBag: () => void; showOrder: (order: MemberOrder) => void; request: <T>(url: string, method?: string, input?: unknown, headers?: Record<string,string>) => Promise<T> };
const Context = createContext<BagContext | null>(null);
export const useOptionalBag = () => useContext(Context);
export function useBag() { const value = useOptionalBag(); if (!value) throw new Error("Member bag provider required"); return value; }
export function BagProvider({ sessionId, csrfToken, children }: { sessionId: string; csrfToken: string; children: ReactNode }) {
 const router = useRouter();
 const [state, setState] = useState(empty), [ready, setReady] = useState(false), [data, setData] = useState<ShopData | null>(null);
 const [notice, setNotice] = useState("");
 const [panel, setPanel] = useState<"bag" | "checkout" | null>(null), [details, setDetails] = useState<MemberOrder | null>(null), [confirmation, setConfirmation] = useState<{ order: OrderView; season: SeasonView } | null>(null);
 const cartRef = useRef<CartState>(empty);
 const attempt = useRef<{ payload: string; key: string } | null>(null);
 useEffect(() => {
  let restored: CartState | null = null;
  try { const raw = sessionStorage.getItem("sfbb:cart"); restored = restoreCart(raw, sessionId); const saved = raw ? JSON.parse(raw) : null; if (saved?.sessionId === sessionId && typeof saved.attempt?.payload === "string" && typeof saved.attempt?.key === "string") attempt.current = saved.attempt; } catch { /* In-memory bag remains usable. */ }
  queueMicrotask(() => { replaceState(restored ?? empty); setReady(true); });
  const clear = () => { setNotice(""); replaceState(empty); attempt.current = null; setPanel(null); setDetails(null); setConfirmation(null); };
  window.addEventListener("sfbb:signout", clear); window.addEventListener("sfbb:season-change", clear);
  return () => { window.removeEventListener("sfbb:signout", clear); window.removeEventListener("sfbb:season-change", clear); };
 }, [sessionId]);
 function replaceState(next: CartState) { cartRef.current = next; setState(next); }
 function persist(next: CartState) { try { sessionStorage.setItem("sfbb:cart", JSON.stringify({ sessionId, state: next, attempt: attempt.current })); } catch { /* Disabled storage does not prevent ordering. */ } }
 function dispatch(action: CartAction) { const next = cartReducer(cartRef.current, action); if (action.type === "CLEAR" || action.type === "LOAD_ORDER") setNotice(""); replaceState(next); persist(next); }
 function configure(catalog: ShopData) { setData(catalog); try { const next = cartReducer(state, { type: "REMOVE_UNAVAILABLE", catalog }); if (state.lines.length && bagSignature(state) !== bagSignature(next)) setNotice("Your bag changed: prices or available items were updated. Review it before continuing."); replaceState(next); persist(next); } catch (e) { setNotice((e as Error).message + " Reduce quantities or remove items before continuing."); } }
 useEffect(() => {
  const changed = (event: Event) => {
   const detail = (event as CustomEvent<{ seasonId: string; styleId: string; deletedStyleId?: string; removedColorIds?: string[]; removedSetIds?: string[] }>).detail;
   if (!detail || detail.seasonId !== state.seasonId) return;
   const removed = state.lines.filter(l => !l.originalLineId && (l.styleId === detail.deletedStyleId || ((!detail.styleId || l.styleId === detail.styleId) && (detail.removedColorIds?.includes(l.colorId) || detail.removedSetIds?.includes(l.artworkSetId)))));
   if (removed.length) { removed.forEach(l => dispatch({ type: "REMOVE", key: l.key })); setNotice("Your bag changed: unavailable items were removed."); }
  };
  window.addEventListener("sfbb:catalog-change", changed); return () => window.removeEventListener("sfbb:catalog-change", changed);
 }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
 async function request<T>(url: string, method = "GET", input?: unknown, headers?: Record<string,string>): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, ...headers }, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) }); }
  catch { throw { message: "Unable to reach the site. Please try again. Your bag is saved." }; }
  if (response.status === 401) { window.location.replace("/login"); throw { message: "Please sign in again." }; }
  let payload; try { payload = await response.json(); } catch { throw { message: "Unable to read the response. Please try again." }; }
  if (!response.ok) throw payload.error; return payload.data as T;
 }
 useEffect(() => {
  const editing = cartRef.current.editing;
  if (!editing) return;
  let active = true;
  const unsubscribe = subscribePreviewChanges(detail => {
   const current = cartRef.current;
   if (!current.lines.some(line => affectsPreview(detail, { styleId: line.styleId, setId: line.artworkSetId, colorId: line.colorId, side: "front" }))) return;
   void request<MemberOrder>("/api/orders/lookup", "POST", { code: editing.code }).then(latest => {
    const current = cartRef.current;
    // Refresh only imagery: retain the draft quantities, snapshots and optimistic order version.
    if (!active || latest.version !== editing.version || current.editing?.id !== editing.id || current.editing.version !== editing.version) return;
    const next = { ...current, editing: { ...current.editing, previews: latest.previews } };
    replaceState(next); persist(next);
   }).catch(() => { /* A background image refresh must not discard an order draft. */ });
  });
  return () => { active = false; unsubscribe(); };
 }, [state.editing?.id, state.editing?.version, csrfToken]); // eslint-disable-line react-hooks/exhaustive-deps
 async function refresh() {
  const catalog = state.editing ? (await request<MemberOrder>("/api/orders/lookup", "POST", { code: state.editing.code })).catalog : await request<ShopData>(`/api/member/catalog${state.preview ? `?previewSeasonId=${state.seasonId}` : ""}`);
  const next = cartReducer(state, { type: "REMOVE_UNAVAILABLE", catalog }); const changed = bagSignature(next) !== bagSignature(state); setData(catalog); replaceState(next); persist(next); return { catalog, changed };
 }
 function startEdit(order: MemberOrder) { dispatch({ type: "LOAD_ORDER", order }); setData(order.catalog); setDetails(null); setPanel("bag"); router.push("/shop"); }
 function submitKey(payload: unknown) { const serialized = JSON.stringify(payload); if (attempt.current?.payload !== serialized) attempt.current = { payload: serialized, key: crypto.randomUUID() }; persist(state); return attempt.current.key; }
 return <Context.Provider value={{ state, data, ready, sessionId, notice, csrfToken, dispatch, configure, openBag: () => setPanel("bag"), showOrder: setDetails, request }}>
  {children}
  {panel === "bag" && <CartDrawer data={data} onClose={() => setPanel(null)} onCheckout={async () => { const result = await refresh(); if (result.changed) throw { message: "Your bag changed: prices or available items were updated. Review it before continuing." }; if (!result.catalog.open) throw { message: "This season is not accepting orders." }; setPanel("checkout"); }} />}
  {panel === "checkout" && data?.season && <CheckoutDialog catalog={data} onClose={() => setPanel(null)} getKey={submitKey} onCatalogChanged={refresh} onSaved={order => { setConfirmation({ order, season: data.season! }); dispatch({ type: "CLEAR", seasonId: state.seasonId }); attempt.current = null; persist(empty); setPanel(null); }} />}
  {confirmation && <ConfirmationDialog {...confirmation} onClose={() => setConfirmation(null)} />}
  {details && <OrderDetailsDialog order={details} onClose={() => setDetails(null)} onChanged={setDetails} onEdit={startEdit} />}
 </Context.Provider>;
}
