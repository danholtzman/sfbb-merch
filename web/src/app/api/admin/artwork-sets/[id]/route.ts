import { artworkDeletion } from "../../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return artworkDeletion(request, context.params); }
