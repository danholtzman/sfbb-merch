export type PreviewChange = { styleId?: string; setId?: string; colorId?: string | null; side?: string };
const eventName="sfbb:preview-change", channelName="sfbb-previews";
export function notifyPreviewChange(detail: PreviewChange) {
 window.dispatchEvent(new CustomEvent(eventName,{detail}));
 try { const channel=new BroadcastChannel(channelName);channel.postMessage(detail);channel.close(); } catch { /* Same-window previews still refresh when channels are unavailable. */ }
}
export function subscribePreviewChanges(listener: (detail?: PreviewChange)=>void) {
 const event=(event:Event)=>listener((event as CustomEvent<PreviewChange>).detail), focus=()=>listener(), visibility=()=>{if(document.visibilityState==="visible")listener();};
 window.addEventListener(eventName,event);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",visibility);
 let channel: BroadcastChannel | null=null;
 try {channel=new BroadcastChannel(channelName);channel.onmessage=event=>listener(event.data as PreviewChange);}catch{/* Navigation/focus and same-window events remain available. */}
 return ()=>{window.removeEventListener(eventName,event);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visibility);channel?.close();};
}
export function affectsPreview(detail: PreviewChange | undefined, target: {styleId:string;setId:string;colorId:string;side:string}) {
 return !detail || ((!detail.styleId || detail.styleId===target.styleId) && (!detail.setId || detail.setId===target.setId) && (!detail.colorId || detail.colorId===target.colorId) && (!detail.side || detail.side===target.side));
}
