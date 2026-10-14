import { isIP } from "node:net";
import type { AuthService } from "../features/auth/service";
import { digest, equalHex, runtimeAuth } from "../features/auth/service";
import { readSessionCookie } from "../features/auth/cookies";
import { AppError } from "../domain/errors";
import type { RequestContext, Role } from "../domain/types";
import { readConfig, type AppConfig } from "./config";

export function assertSameOrigin(request: Request, config: AppConfig): void {
  if (request.headers.get("Origin") !== config.publicOrigin || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new AppError("CROSS_ORIGIN", 403, "This request must come from the merchandise site.");
  }
}
// Next route handlers do not expose the TCP peer. Only a secret-authenticated,
// explicitly configured Caddy header can supply an address; other headers are ignored.
export function trustedClientAddress(request: Request, config: AppConfig): string {
  const supplied = request.headers.get("X-SFBB-Proxy-Secret");
  const address = request.headers.get("X-SFBB-Client-IP");
  if (config.trustedProxySecret && supplied && address && isIP(address) && equalHex(digest(supplied), digest(config.trustedProxySecret))) return address;
  return "untrusted";
}
export function createAuthorization({ auth, config, now = () => new Date() }: { auth: AuthService; config: AppConfig; now?: () => Date }) {
  async function requireActor(request: Request, role?: Role): Promise<RequestContext> {
    const serverNow = now();
    const actor = await auth.getActor(readSessionCookie(request, config), serverNow);
    if (!actor) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to continue.");
    if (role && actor.role !== role) throw new AppError("FORBIDDEN", 403, "Administrator access is required.");
    return { actor, now: serverNow };
  }
  async function authorizeMutation(request: Request, context: RequestContext): Promise<void> {
    assertSameOrigin(request, config);
    const session = await auth.getSession(readSessionCookie(request, config), now());
    if (!session || session.id !== context.actor.sessionId || session.role !== context.actor.role) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to continue.");
    const csrf = request.headers.get("X-CSRF-Token");
    if (!csrf || !equalHex(digest(csrf), session.csrfTokenHash)) throw new AppError("INVALID_CSRF", 403, "Please reload the page and try again.");
  }
  return { requireActor, authorizeMutation };
}
export type Authorization = ReturnType<typeof createAuthorization>;
function runtimeAuthorization(): Authorization { return createAuthorization({ auth: runtimeAuth(), config: readConfig(process.env) }); }
export async function requireActor(request: Request, role?: Role): Promise<RequestContext> { return runtimeAuthorization().requireActor(request, role); }
export async function authorizeMutation(request: Request, context: RequestContext): Promise<void> { await runtimeAuthorization().authorizeMutation(request, context); }
