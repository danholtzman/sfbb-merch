import { memberOrderMutation } from "../../../../../features/orders/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ code: string }> }) { return memberOrderMutation(request, context.params, "cancel"); }
