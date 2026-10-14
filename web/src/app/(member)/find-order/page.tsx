import { Header } from "../../../components/Header";
import { requirePageSession } from "../../../server/context";
export const dynamic = "force-dynamic";
export default async function FindOrderPage() {
  const session = await requirePageSession();
  return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="find" /><main className="app-content"><h1>Find my order</h1><p>Order lookup is not available yet.</p></main></>;
}
