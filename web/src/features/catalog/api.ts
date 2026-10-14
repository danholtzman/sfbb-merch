export async function catalogRequest<T>(csrfToken: string, url: string, method = "GET", input?: unknown): Promise<T> {
 let response: Response;
 try { response = await fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, ...(input ? { body: JSON.stringify(input) } : {}) }); }
 catch { throw { message: "Unable to reach the site. Please try again." }; }
 const payload = await response.json(); if (!response.ok) throw payload.error; return payload.data as T;
}
export function notifyCatalogChange(detail: { seasonId: string; styleId: string; removedColorIds?: string[]; removedSetIds?: string[]; deletedStyleId?: string }) {
 // The member cart in Stage 8 consumes the stable IDs; never remap array indices.
 window.dispatchEvent(new CustomEvent("sfbb:catalog-change", { detail }));
}
