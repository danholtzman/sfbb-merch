import { notFound } from "next/navigation";
import { Header } from "../../../components/Header";
import { requirePageSession } from "../../../server/context";
import { createMemberData } from "../../../features/orders/member-data";
import { Shop } from "../../../features/orders/Shop";
import { idSchema } from "../../../domain/schemas";
export const dynamic = "force-dynamic";
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ previewSeasonId?: string | string[] }> }) {
 const session = await requirePageSession(); const { previewSeasonId } = await searchParams;
 if (previewSeasonId !== undefined && (session.actor.role !== "admin" || !idSchema.safeParse(previewSeasonId).success)) notFound();
 const data = await createMemberData().shop({ actor: session.actor, now: new Date() }, previewSeasonId as string | undefined).catch(error => { if (error.status === 404) notFound(); throw error; });
 return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="shop" /><main className="app-content member-content"><Shop initial={data} /></main></>;
}
