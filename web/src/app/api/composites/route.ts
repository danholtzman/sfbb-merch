import { compositeRead } from "../../../features/artwork/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return compositeRead(request); }
