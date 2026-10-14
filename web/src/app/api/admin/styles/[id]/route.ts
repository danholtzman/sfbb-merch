import { catalogMutation } from "../../../../../features/catalog/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return catalogMutation(request, context.params, "delete"); }
