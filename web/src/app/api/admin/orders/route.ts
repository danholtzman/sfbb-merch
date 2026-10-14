import { adminOrders } from "../../../../features/orders/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return adminOrders(request); }
