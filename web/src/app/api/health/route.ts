export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Process liveness only; database readiness is checked separately during release. */
export async function GET(): Promise<Response> {
  return Response.json({ data: { status: "ok" } }, { headers: { "Cache-Control": "no-store" } });
}
