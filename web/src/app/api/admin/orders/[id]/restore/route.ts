import { adminOrderMutation } from "../../../../../../features/orders/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return adminOrderMutation(request, context.params, "restore"); }
