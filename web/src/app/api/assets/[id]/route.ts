import { assetRead } from "../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) { return assetRead(request, context.params); }
