import { Header } from "../../components/Header";
import { requirePageSession } from "../../server/context";
import { db, initializeDatabase } from "../../server/db";
import { bandDate } from "../../domain/clock";
import { createSeasonService } from "../../features/seasons/service";
import { AdminSeasons } from "../../features/seasons/AdminSeasons";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const session = await requirePageSession("admin");
  const now = new Date();
  await initializeDatabase(db, now);
  const seasons = await createSeasonService().listSeasons({ actor: session.actor, now });
  return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="admin" /><main className="app-content">
    <AdminSeasons initial={seasons} csrfToken={session.csrfToken} today={bandDate(now)} now={now.toISOString()} />
    <section className="mobile-member-only"><h1>Season shop</h1><p>No collection is available yet.</p></section>
  </main></>;
}
