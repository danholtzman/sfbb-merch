import { seasonMutation } from "../../../../../../features/seasons/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return seasonMutation(request, context.params, "publish"); }
