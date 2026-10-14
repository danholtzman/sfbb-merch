import type { ReactNode } from "react";
import { requirePageSession } from "../../server/context";
import { BagProvider } from "../../features/orders/BagProvider";
export default async function MemberLayout({ children }: { children: ReactNode }) { const session = await requirePageSession(); return <BagProvider sessionId={session.actor.sessionId} csrfToken={session.csrfToken}>{children}</BagProvider>; }
