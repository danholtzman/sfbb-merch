import { orderSubmit } from "../../../features/orders/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return orderSubmit(request); }
