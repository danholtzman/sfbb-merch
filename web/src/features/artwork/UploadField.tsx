"use client";
export function UploadField({ label, accept, onFile, disabled = false }: { label: string; accept: string; onFile: (file: File) => Promise<void>; disabled?: boolean }) {
 return <label className="upload-field">{label}<input type="file" accept={accept} disabled={disabled} onChange={async event => { const input = event.currentTarget, file = input.files?.[0]; if (file) { try { await onFile(file); } finally { input.value = ""; } } }} /></label>;
}
export async function uploadImage<T>(csrfToken: string, url: string, file: File, expectedVersion: number, colorId?: string): Promise<T> {
 const form = new FormData(); form.set("file", file); form.set("expectedVersion", String(expectedVersion)); if (colorId) form.set("colorId", colorId);
 let response: Response;
 try { response = await fetch(url, { method: "POST", headers: { "X-CSRF-Token": csrfToken }, body: form }); }
 catch { throw { message: "Upload failed. Please try again." }; }
 const payload = await response.json(); if (!response.ok) throw payload.error; return payload.data as T;
}
