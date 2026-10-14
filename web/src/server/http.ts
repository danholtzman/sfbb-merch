import { AppError } from "../domain/errors";
export function jsonData(data: unknown, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json({ data }, { headers: responseHeaders });
}
export async function apiResponse(work: () => Promise<Response>): Promise<Response> {
  try { return await work(); }
  catch (error) {
    if (error instanceof AppError) return Response.json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("Request failed", { name: error instanceof Error ? error.name : "Unknown" });
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "Unable to complete the request. Please try again." } }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
export async function readSmallJson(request: Request, maxBytes = 4096): Promise<unknown> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError("INVALID_INPUT", 422, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_INPUT", 422, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) { await reader.cancel(); throw new AppError("INVALID_INPUT", 422, "Request is too large."); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_INPUT", 422, "Invalid JSON request.");
  } finally { reader.releaseLock(); }
}
