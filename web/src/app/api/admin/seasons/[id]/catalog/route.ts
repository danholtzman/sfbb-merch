import { catalogCollection } from "../../../../../../features/catalog/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) { return catalogCollection(request, context.params); }
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return catalogCollection(request, context.params); }
