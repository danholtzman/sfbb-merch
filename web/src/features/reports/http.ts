import { z } from "zod";
import { requireActor } from "../../server/authorization";
import { apiResponse } from "../../server/http";
import { parseOrder } from "../orders/validation";
import { createReportService } from "./service";
export function reportDownload(request: Request, params: Promise<{ report: string }>) {
 return apiResponse(async () => { const ctx = await requireActor(request,"admin"), { report: raw } = await params;
 const report = parseOrder(z.enum(["billing","member-delivery","product-delivery","manufacturer-order"]),raw), seasonId = new URL(request.url).searchParams.get("seasonId") ?? "";
 const result = await createReportService(undefined, () => new Date()).export(ctx,seasonId,report);
 return new Response(new Uint8Array(result.bytes), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); });
}
