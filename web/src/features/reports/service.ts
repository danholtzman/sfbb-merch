import type { PrismaClient } from "../../generated/prisma/client";
import type { RequestContext } from "../../domain/types";
import { db, withTransaction } from "../../server/db";
import { AppError } from "../../domain/errors";
import { idSchema } from "../../domain/schemas";
import { toOrderView } from "../orders/service";
import { parseOrder } from "../orders/validation";
import { billingRows, deliveryRows, manufacturerRows, csvEncode, reportFilename, type Report } from "./rows";
export function createReportService(client: PrismaClient = db, clock?: () => Date) { return {
 async export(ctx: RequestContext, seasonId: string, report: Report) {
  if (ctx.actor.role !== "admin") throw new AppError("FORBIDDEN",403,"Administrator access is required.");
  parseOrder(idSchema,seasonId);
  return withTransaction(async tx => {
   const now = clock?.() ?? ctx.now;
   if (!await tx.session.findFirst({ where: { id: ctx.actor.sessionId, role: "admin", expiresAt: { gt: now } } })) throw new AppError("UNAUTHENTICATED",401,"Please sign in to continue.");
   const season = await tx.season.findUnique({ where: { id: seasonId } }); if (!season) throw new AppError("NOT_FOUND",404,"Season not found.");
   const orders = (await tx.order.findMany({ where: { seasonId }, include: { lines: { orderBy: { position: "asc" } }, season: true } })).map(toOrderView);
   const rows = report === "billing" ? billingRows(orders) : report === "member-delivery" ? deliveryRows(orders) : manufacturerRows(orders);
   return { filename: reportFilename(season,report), bytes: csvEncode(rows) };
  }, client);
 }
}; }
