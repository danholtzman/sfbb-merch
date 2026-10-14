import { imageUpload } from "../../../../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ id: string; side: string }> }) { return imageUpload(request, context.params, "artwork"); }
