import { imageUpload, artworkSideDeletion } from "../../../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ id: string; side: string }> }) { return imageUpload(request, context.params, "artwork"); }
export function DELETE(request: Request, context: { params: Promise<{ id: string; side: string }> }) { return artworkSideDeletion(request, context.params); }
