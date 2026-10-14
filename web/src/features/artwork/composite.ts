import type { PlacementValues, Side } from "../../domain/types";
export type CompositeSpec = { blankUrl: string | null; artworkUrl: string | null; cut: "classic" | "fitted" | "long"; color: string; side: Side; placement: PlacementValues };
export const DEFAULT_PLACEMENT: PlacementValues = { x: 50, y: 47.7, width: 25, rotation: 0 };
const number = (n: number) => Number(n.toFixed(6));
export function placementTransform(values: PlacementValues): string {
 return `translate(${number(values.x * 3.2)} ${number(values.y * 3.1)}) rotate(${values.rotation}) scale(${number(values.width * 3.2 / 80)}) translate(-160 -148)`;
}
export function resolvePlacement(shared: PlacementValues | null, override: PlacementValues | null): PlacementValues {
 const value = override ?? shared ?? DEFAULT_PLACEMENT;
 return { x: value.x, y: value.y, width: value.width, rotation: value.rotation };
}
export function sampleShape(cut: CompositeSpec["cut"]): string {
 return cut === "long" ? "M90 35 L125 20 Q160 43 195 20 L230 35 L275 245 L245 253 L218 113 L215 275 Q160 284 105 275 L102 113 L75 253 L45 245 Z" : cut === "fitted" ? "M80 48 L125 20 Q160 43 195 20 L240 48 L263 77 L234 107 L207 83 Q197 170 212 275 Q160 284 108 275 Q123 170 113 83 L86 107 L57 77 Z" : "M80 48 L125 20 Q160 43 195 20 L240 48 L265 80 L235 109 L210 83 L210 275 Q160 284 110 275 L110 83 L85 109 L55 80 Z";
}

export type CanvasPoint = { x: number; y: number };
export type StoredPlacement = { values: PlacementValues; version: number };
export type PlacementEditorData = { spec: CompositeSpec; shared: StoredPlacement | null; override: StoredPlacement | null };
export function canvasPoint(rect: { left: number; top: number; width: number; height: number }, x: number, y: number): CanvasPoint {
 const scale = Math.min(rect.width/320,rect.height/310); if (!Number.isFinite(scale) || scale<=0) throw new Error("Canvas is unavailable.");
 return { x:number((x-rect.left-(rect.width-320*scale)/2)/scale), y:number((y-rect.top-(rect.height-310*scale)/2)/scale) };
}
const clamp = (value: number, min: number, max: number) => number(Math.min(max,Math.max(min,value)));
export function nudge(values: PlacementValues, key: string, shift: boolean): PlacementValues {
 const step=shift ? 1 : .2;
 return { ...values, x:clamp(values.x+(key==="ArrowLeft" ? -step : key==="ArrowRight" ? step : 0),0,100), y:clamp(values.y+(key==="ArrowUp" ? -step : key==="ArrowDown" ? step : 0),0,100) };
}
export function movePlacement(values: PlacementValues, from: CanvasPoint, to: CanvasPoint): PlacementValues {
 return { ...values, x:clamp(values.x+(to.x-from.x)/3.2,0,100), y:clamp(values.y+(to.y-from.y)/3.1,0,100) };
}
export function resizePlacement(values: PlacementValues, from: CanvasPoint, to: CanvasPoint): PlacementValues {
 const center={x:values.x*3.2,y:values.y*3.1}, initial=Math.hypot(from.x-center.x,from.y-center.y);
 return initial<.000001 ? { ...values } : { ...values, width:clamp(values.width*Math.hypot(to.x-center.x,to.y-center.y)/initial,5,90) };
}
export function centerPlacement(values: PlacementValues): PlacementValues { return { ...values, x:50 }; }
export function resetPlacement(): PlacementValues { return { ...DEFAULT_PLACEMENT }; }
