import { placementSave, placementRead } from "../../../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return placementSave(request, context.params); }

export function GET(request: Request, context: { params: Promise<{ id: string }> }) { return placementRead(request, context.params); }
