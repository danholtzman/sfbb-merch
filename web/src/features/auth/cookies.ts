import type { AppConfig } from "../../server/config";
export function sessionCookieName(config: AppConfig): string {
  return config.publicOrigin.startsWith("https:") ? "__Host-sfbb_session" : "sfbb_session";
}
export function readSessionCookie(request: Request, config: AppConfig): string | undefined {
  const name = sessionCookieName(config);
  const entries = (request.headers.get("Cookie") ?? "").split(";").map(p => p.trim()).filter(p => p.startsWith(`${name}=`));
  return entries.length === 1 ? entries[0].slice(name.length + 1) : undefined;
}
export function sessionCookie(config: AppConfig, token: string, maxAge = config.sessionTtlSeconds): string {
  return `${sessionCookieName(config)}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${config.publicOrigin.startsWith("https:") ? "; Secure" : ""}`;
}
