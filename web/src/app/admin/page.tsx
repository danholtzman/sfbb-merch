import { Header } from "../../components/Header";
import { requirePageSession } from "../../server/context";
import { db, initializeDatabase } from "../../server/db";
import { bandDate } from "../../domain/clock";
import { createSeasonService } from "../../features/seasons/service";
import { AdminSeasons } from "../../features/seasons/AdminSeasons";
import { BagProvider } from "../../features/orders/BagProvider";
import { Shop } from "../../features/orders/Shop";
import { createMemberData } from "../../features/orders/member-data";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const session = await requirePageSession("admin");
  const now = new Date();
  await initializeDatabase(db, now);
  const seasons = await createSeasonService().listSeasons({ actor: session.actor, now });
  const shop = await createMemberData().shop({ actor: session.actor, now });
  return <BagProvider sessionId={session.actor.sessionId} csrfToken={session.csrfToken}><Header role={session.actor.role} csrfToken={session.csrfToken} active="admin" /><main className="app-content">
    <AdminSeasons initial={seasons} csrfToken={session.csrfToken} today={bandDate(now)} now={now.toISOString()} />
    <section className="mobile-member-only"><Shop initial={shop} /></section>
  </main></BagProvider>;
}
