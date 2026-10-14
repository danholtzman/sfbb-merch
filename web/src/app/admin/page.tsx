import { Header } from "../../components/Header";
import { requirePageSession } from "../../server/context";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const session = await requirePageSession("admin");
  return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="admin" /><main className="app-content">
    <section className="desktop-only"><h1>Merchandise admin</h1><h2>Orders</h2><p>Order management is not available yet.</p></section>
    <section className="mobile-member-only"><h1>Season shop</h1><p>No collection is available yet.</p></section>
  </main></>;
}
