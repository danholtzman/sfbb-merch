import { handleAuth } from "../../../../features/auth/handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> { return handleAuth("logout", request); }
