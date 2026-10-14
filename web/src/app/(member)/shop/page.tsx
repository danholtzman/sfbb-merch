import { Header } from "../../../components/Header";
import { requirePageSession } from "../../../server/context";
export const dynamic = "force-dynamic";
export default async function ShopPage() {
  const session = await requirePageSession();
  return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="shop" /><main className="app-content"><h1>Season shop</h1><p>No collection is available yet.</p></main></>;
}
