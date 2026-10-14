import { artworkCollection } from "../../../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return artworkCollection(request, context.params); }
