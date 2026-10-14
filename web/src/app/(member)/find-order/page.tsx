import { Header } from "../../../components/Header";
import { requirePageSession } from "../../../server/context";
import { FindOrder } from "../../../features/orders/LookupDialog";
export const dynamic = "force-dynamic";
export default async function FindOrderPage() { const session = await requirePageSession(); return <><Header role={session.actor.role} csrfToken={session.csrfToken} active="find" /><main className="app-content"><FindOrder /></main></>; }
