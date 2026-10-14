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
