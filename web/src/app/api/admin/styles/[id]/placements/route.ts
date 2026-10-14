import { placementSave } from "../../../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return placementSave(request, context.params); }
