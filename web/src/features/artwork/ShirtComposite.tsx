"use client";
import { useEffect, useState } from "react";
import { placementTransform, sampleShape, type CompositeSpec } from "./composite";
export function Composite({ spec, label }: { spec: CompositeSpec; label: string }) {
 const [failedBlank, setFailedBlank] = useState<string | null>(null), [failedArtwork, setFailedArtwork] = useState<string | null>(null);
 return <svg viewBox="0 0 320 310" role="img" aria-label={label} className="composite-svg">
  {spec.blankUrl && failedBlank !== spec.blankUrl ? <image data-blank="true" href={spec.blankUrl} x="0" y="0" width="320" height="310" preserveAspectRatio="xMidYMid meet" onError={() => setFailedBlank(spec.blankUrl)} /> : <><path d={sampleShape(spec.cut)} fill={spec.color} /><path d="M125 20 Q160 65 195 20" fill="none" stroke="#000" opacity=".15" strokeWidth="5" /></>}
  {spec.artworkUrl && failedArtwork !== spec.artworkUrl && <g transform={placementTransform(spec.placement)}><image data-artwork="true" href={spec.artworkUrl} x="120" y="80" width="80" height="136" preserveAspectRatio="xMidYMid meet" onError={() => setFailedArtwork(spec.artworkUrl)} /></g>}
  {(failedBlank === spec.blankUrl && spec.blankUrl || failedArtwork === spec.artworkUrl && spec.artworkUrl) && <text x="160" y="302" textAnchor="middle" fontSize="11">Image unavailable — upload it again</text>}
 </svg>;
}
export function useComposite(styleId: string, setId: string, colorId: string, side: string, revision: number) {
 const key = `${styleId}:${setId}:${colorId}:${side}:${revision}`;
 const [result, setResult] = useState<{ key: string; spec: CompositeSpec | null; error: boolean } | null>(null);
 useEffect(() => {
  let active = true;
  const query = new URLSearchParams({ styleId, setId, colorId, side });
  fetch(`/api/composites?${query}`, { cache: "no-store" }).then(async response => { if (!response.ok) throw new Error(); return (await response.json()).data as CompositeSpec; }).then(value => { if (active) setResult({ key, spec: value, error: false }); }).catch(() => { if (active) setResult({ key, spec: null, error: true }); });
  return () => { active = false; };
 }, [styleId, setId, colorId, side, revision, key]);
 return result?.key === key ? result : { spec: null, error: false };
}
export function CompositePreview({ styleId, setId, colorId, side, revision, label }: { styleId: string; setId: string; colorId: string; side: string; revision: number; label: string }) {
 const { spec, error } = useComposite(styleId, setId, colorId, side, revision);
 return spec ? <Composite spec={spec} label={label} /> : <div className="preview-loading">{error ? "Preview unavailable. Reload to try again." : "Loading preview…"}</div>;
}
