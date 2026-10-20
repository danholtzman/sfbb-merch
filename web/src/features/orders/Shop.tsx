"use client";
import { useEffect, useState } from "react";
import type { StyleView, Side } from "../../domain/types";
import type { ShopData } from "./member-data";
import { useBag } from "./BagProvider";
import { CompositePreview } from "../artwork/ShirtComposite";
import { formatUsd } from "../../domain/money";
export function displayDate(date: string) { return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)); }
export function Shop({ initial }: { initial: ShopData }) {
 const bag = useBag();
 useEffect(() => { if (bag.ready) bag.configure(initial.preview ? initial : bag.state.editing?.catalog ?? initial); }, [initial, bag.ready]); // eslint-disable-line react-hooks/exhaustive-deps
 const data = bag.state.editing ? bag.data ?? bag.state.editing.catalog : bag.data ?? initial;
 return <section className="member-shop">
  {bag.state.editing && <div className="preview-notice"><strong>Editing order {bag.state.editing.code}</strong><p>Adjust your bag, then check out to save changes to this order.</p><button className="text-button" onClick={() => { bag.dispatch({ type: "CLEAR" }); bag.configure(initial); }}>Discard changes</button></div>}
  {data.preview && <div className="preview-notice"><strong>Preview only — checkout unavailable</strong><p>Try a test bag for this season. Members can order once it is published and its ordering window is open.</p></div>}
  {data.season ? <>
   <section className="member-hero"><div className="hero-copy"><span className="eyebrow">{data.season.name}</span><h1>Wear the music.</h1>{data.season.announcement && <p>{data.season.announcement}</p>}<div className="hero-bottom"><span className="status-badge">{data.preview ? "Season preview" : data.status}</span><span>Through {displayDate(data.season.closesOn)}</span></div></div><div className="hero-art" aria-hidden="true"><span>SAN FRANCISCO</span><b>BRASS<br /><em>&</em> BOLD.</b><small>ONE BAND. ONE BIG SOUND.</small></div></section>
   <div className="section-heading lineup-heading"><h2>The season lineup <small>{String(data.styles.length).padStart(2,"0")}</small></h2><p>Pick your fit. Find your color. Make it yours.</p></div>
   <div className="product-grid">{data.styles.map(style => <Product key={`${data.season!.id}:${style.id}`} style={style} data={data} />)}</div>
   {!data.styles.length && <p className="empty-state">No shirts have been added to this collection.</p>}
  </> : <><h1>Season shop</h1><p>No collection is available yet.</p></>}
 </section>;
}
function Product({ style, data }: { style: StyleView; data: ShopData }) {
 const bag = useBag(); const [colorId, setColorId] = useState(style.colors[0]?.id ?? ""), [setId, setSetId] = useState(style.artworkSetIds[0] ?? ""), [sizeId, setSizeId] = useState(""), [quantity, setQuantity] = useState("1"), [side, setSide] = useState<Side>("front"), [error, setError] = useState(""), [message, setMessage] = useState("");
 const color = style.colors.find(c => c.id === colorId) ?? style.colors[0], set = data.artworkSets.find(s => s.id === (style.artworkSetIds.includes(setId) ? setId : style.artworkSetIds[0]));
 const hasBack=!!color && !!style.backPhotoColorIds?.includes(color.id), previewSide=side === "back" && hasBack ? "back" : "front";
 function add() {
  setError(""); setMessage(""); const size = style.sizes.find(s => s.id === sizeId), qty = Number(quantity);
  if (!size) { setError("Select your size before adding this shirt."); return; }
  if (!/^\d+$/.test(quantity) || !Number.isInteger(qty) || qty < 1 || qty > 2147483647) { setError("Qty must be a positive whole number."); return; }
  if (!color || !set) { setError("This shirt is currently unavailable."); return; }
  try { bag.dispatch({ type: "ADD", line: { key: crypto.randomUUID(), styleId: style.id, artworkSetId: set.id, colorId: color.id, sizeId: size.id, quantity: qty, unitPriceCents: style.unitPriceCents, styleName: style.name, artworkSetName: set.name, colorName: color.name, colorHex: color.hex, sizeLabel: size.label } }); setMessage(`${qty} added to your bag.`); }
  catch (e) { setError((e as Error).message); }
 }
 return <article className="product" aria-label={style.name}>
  <div className="product-image">{color && set && <CompositePreview styleId={style.id} setId={set.id} colorId={color.id} side={previewSide} revision={data.season?.version ?? 0} label={`${style.name} ${previewSide} in ${color.name}`} />}<div className="shirt-view-toggle" aria-label="Shirt view">{(hasBack ? ["front","back"] as const : ["front"] as const).map(s => <button key={s} aria-pressed={previewSide === s} onClick={() => setSide(s)}>{s === "front" ? "Front" : "Back"}</button>)}</div></div>
  <div className="product-head"><h3>{style.name}</h3><strong>{formatUsd(style.unitPriceCents)}</strong></div><p>{style.description}</p>
  <div className="color-row" role="group" aria-label="Color">{style.colors.map(c => <button key={c.id} className="swatch" style={{ backgroundColor: c.hex }} aria-label={c.name} aria-pressed={color?.id === c.id} onClick={() => setColorId(c.id)} />)}<span>{color?.name}</span></div>
  {style.artworkSetIds.length > 1 && <label className="product-design">Artwork set<select value={set?.id ?? ""} onChange={e => setSetId(e.target.value)}>{style.artworkSetIds.map(id => <option key={id} value={id}>{data.artworkSets.find(s => s.id === id)?.name}</option>)}</select></label>}
  <div className="product-controls"><select aria-label="Size" value={sizeId} onChange={e => setSizeId(e.target.value)}><option value="">Select your size</option>{style.sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><label className="product-quantity">Qty<input type="number" min="1" max="2147483647" step="1" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><button className="add-button" disabled={!bag.ready || (!data.open && !data.preview)} onClick={add}>Add +</button></div>
  {style.manufacturerUrl && <p><a href={style.manufacturerUrl} target="_blank" rel="noopener noreferrer">View manufacturer details ↗</a></p>}
  {error && <p className="form-error" role="alert">{error}</p>}<span className="add-message" role="status">{message}</span>
 </article>;
}
