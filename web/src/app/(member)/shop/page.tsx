import { notFound } from "next/navigation";
import { Header } from "../../../components/Header";
import { requirePageSession } from "../../../server/context";
import { db } from "../../../server/db";
import { idSchema } from "../../../domain/schemas";
export const dynamic = "force-dynamic";
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ previewSeasonId?: string | string[] }> }) {
  const session = await requirePageSession();
  const { previewSeasonId } = await searchParams;
  let preview = null;
  if (previewSeasonId !== undefined) {
    if (session.actor.role !== "admin" || !idSchema.safeParse(previewSeasonId).success) notFound();
    preview = await db.season.findUnique({ where: { id: previewSeasonId as string } });
    if (!preview) notFound();
  }
  return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="shop" /><main className="app-content"><h1>Season shop</h1>
    {preview ? <><div className="preview-notice"><strong>Preview only — checkout unavailable</strong><p>{preview.name} · {preview.opensOn} – {preview.closesOn}</p></div>{preview.announcement && <p>{preview.announcement}</p>}<p>Product previews will be available after shirt style and artwork management are implemented.</p></> : <p>No collection is available yet.</p>}
  </main></>;
}
