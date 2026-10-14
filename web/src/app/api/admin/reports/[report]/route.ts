import { reportDownload } from "../../../../../features/reports/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ report: string }> }) { return reportDownload(request, context.params); }
