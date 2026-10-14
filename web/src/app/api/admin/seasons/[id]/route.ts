import { seasonMutation } from "../../../../../features/seasons/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return seasonMutation(request, context.params, "update"); }
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return seasonMutation(request, context.params, "delete"); }
