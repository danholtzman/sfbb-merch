import { scryptSync } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { testDatabase } from "../fixtures/database";
import credentials from "../fixtures/credentials.json" with { type: "json" };
import { readConfig } from "../../src/server/config";
import { createAuthService } from "../../src/features/auth/service";
import { createAuthHandlers } from "../../src/features/auth/handlers";
import { createAuthorization } from "../../src/server/authorization";

const hash = (password: string) => { const salt = Buffer.alloc(16, 17); return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`; };
const hashes = { member: hash(credentials.memberPassword), admin: hash(credentials.adminPassword) };
let database: Awaited<ReturnType<typeof testDatabase>>;
let auth: ReturnType<typeof createAuthService>;
let authorization: ReturnType<typeof createAuthorization>;
let handlers: ReturnType<typeof createAuthHandlers>;
let now: Date;
const origin = "https://sfbb.holtzman.io";
const config = readConfig({ NODE_ENV: "production", DATABASE_URL: "file:/data/test.sqlite", DATA_DIR: "/data", MEMBER_PASSWORD_HASH: hashes.member, ADMIN_PASSWORD_HASH: hashes.admin, SESSION_SECRET: "test-only-session-secret-".repeat(4) });
const cookie = (token: string) => `__Host-sfbb_session=${token}`;
function request(path: string, options: { token?: string; csrf?: string; origin?: string; body?: unknown; method?: string; headers?: Record<string, string> } = {}) {
  return new Request(origin + path, { method: options.method ?? (options.body === undefined ? "GET" : "POST"), headers: {
    ...(options.token ? { Cookie: cookie(options.token) } : {}),
    ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}),
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    Origin: options.origin ?? origin, ...options.headers,
  }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
}
beforeEach(async () => {
  now = new Date("2026-10-14T18:00:00Z");
  database = await testDatabase();
  auth = createAuthService({ client: database.client, config });
  authorization = createAuthorization({ auth, config, now: () => now });
  handlers = createAuthHandlers({ auth, authorization, config, now: () => now });
});
afterEach(async () => { await database?.close(); });

it("unauthenticated_admin_api_returns_401", async () => {
  const response = await handlers.adminSession(request("/api/admin/session"));
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
});
it("member_mutation_returns_403", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  await expect(authorization.requireActor(request("/api/seasons", { token: session.token, method: "POST" }), "admin")).rejects.toMatchObject({ status: 403 });
  expect((await handlers.adminSession(request("/api/admin/session", { token: session.token }))).status).toBe(403);
});
it("spoofed_role_is_ignored", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  const context = await authorization.requireActor(request("/api/auth/session", { token: session.token, body: { role: "admin", now: "2099-01-01" }, headers: { "X-Role": "admin" } }));
  expect(context).toMatchObject({ actor: { role: "member" }, now });
});
it("stores only session token and CSRF hashes", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(session.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  const stored = await database.client.session.findUniqueOrThrow({ where: { id: session.actor.sessionId } });
  expect(stored.tokenHash).not.toContain(session.token);
  expect(stored.csrfTokenHash).not.toBe(session.csrfToken);
  expect(stored).toMatchObject({ role: "member", expiresAt: new Date("2026-10-15T06:00:00Z") });
});
it("logout_invalidates_cookie", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  const response = await handlers.logout(request("/api/auth/logout", { token: session.token, csrf: session.csrfToken, method: "POST" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  expect(await auth.getActor(session.token, now)).toBeNull();
  expect((await handlers.session(request("/api/auth/session", { token: session.token }))).status).toBe(401);
});
it("cross_origin_mutation_is_rejected", async () => {
  const session = await auth.signIn("admin", credentials.adminPassword, now);
  const forged = request("/api/auth/logout", { token: session.token, csrf: session.csrfToken, origin: "https://evil.example", method: "POST" });
  expect((await handlers.logout(forged)).status).toBe(403);
  expect(await auth.getActor(session.token, now)).not.toBeNull();
});
it("rejects missing or another session's CSRF token", async () => {
  const first = await auth.signIn("user", credentials.memberPassword, now);
  const second = await auth.signIn("user", credentials.memberPassword, now);
  for (const csrf of [undefined, "wrong", second.csrfToken]) {
    expect((await handlers.logout(request("/api/auth/logout", { token: first.token, csrf, method: "POST" }))).status).toBe(403);
  }
  expect(await auth.getActor(first.token, now)).not.toBeNull();
});
it("session_expires_after_12_hours", async () => {
  const session = await auth.signIn("admin", credentials.adminPassword, now);
  expect(await auth.getActor(session.token, new Date("2026-10-15T05:59:59Z"))).toMatchObject({ role: "admin" });
  expect(await auth.getActor(session.token, new Date("2026-10-15T06:00:00Z"))).toBeNull();
  now = new Date("2026-10-15T06:00:00Z");
  expect((await handlers.adminSession(request("/api/admin/session", { token: session.token }))).status).toBe(401);
});
it("signs in both shared accounts with generic credential errors", async () => {
  expect((await auth.signIn(" ADMIN ", credentials.adminPassword, now)).actor.role).toBe("admin");
  for (const [username, password] of [["user", "wrong"], ["admin", credentials.memberPassword], ["unknown", credentials.adminPassword]]) {
    await expect(auth.signIn(username, password, now)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401, message: "Username or password is incorrect. Please try again." });
  }
});
it("limits five failed attempts per username/address for fifteen minutes, persisting across service restart", async () => {
  for (let i = 0; i < 5; i++) await expect(auth.signIn("user", "wrong", now, "203.0.113.1")).rejects.toMatchObject({ status: 401 });
  const restarted = createAuthService({ client: database.client, config });
  await expect(restarted.signIn("user", credentials.memberPassword, now, "203.0.113.1")).rejects.toMatchObject({ status: 429 });
  expect((await restarted.signIn("admin", credentials.adminPassword, now, "203.0.113.1")).actor.role).toBe("admin");
  expect((await restarted.signIn("user", credentials.memberPassword, now, "203.0.113.2")).actor.role).toBe("member");
  expect((await restarted.signIn("user", credentials.memberPassword, new Date(now.getTime() + 900000), "203.0.113.1")).actor.role).toBe("member");
});
it("serializes concurrent failed logins so only five are evaluated", async () => {
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => auth.signIn("user", "wrong", now, "203.0.113.9")));
  expect(results.filter(r => r.status === "rejected" && r.reason.status === 401)).toHaveLength(5);
  expect(results.filter(r => r.status === "rejected" && r.reason.status === 429)).toHaveLength(3);
});
it("untrusted forwarding headers cannot evade login throttling", async () => {
  for (let i = 0; i < 5; i++) {
    expect((await handlers.login(request("/api/auth/login", { body: { username: "user", password: "wrong" }, headers: { "CF-Connecting-IP": `203.0.113.${i}`, "X-Forwarded-For": `203.0.113.${i}`, "X-SFBB-Client-IP": `203.0.113.${i}` } }))).status).toBe(401);
  }
  expect((await handlers.login(request("/api/auth/login", { body: { username: "user", password: credentials.memberPassword }, headers: { "X-SFBB-Client-IP": "203.0.113.99" } }))).status).toBe(429);
});
it("rejects cross-origin login before creating a session", async () => {
  const response = await handlers.login(request("/api/auth/login", { body: { username: "admin", password: credentials.adminPassword }, origin: "https://evil.example" }));
  expect(response.status).toBe(403);
  expect(await database.client.session.count()).toBe(0);
});
it("production cookies and auth responses are private", async () => {
  const response = await handlers.login(request("/api/auth/login", { body: { username: "user", password: credentials.memberPassword } }));
  expect(response.status).toBe(200);
  const header = response.headers.get("Set-Cookie")!;
  expect(header).toMatch(/^__Host-sfbb_session=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=43200"]) expect(header).toContain(flag);
  expect(header).not.toContain("Domain=");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ data: { role: "member", redirect: "/shop" } });
});
it("rejects malformed and oversized login payloads without creating sessions", async () => {
  for (const body of [{ username: "user", password: credentials.memberPassword, role: "admin" }, { username: "user", password: "x".repeat(5000) }, { username: "user" }]) {
    expect((await handlers.login(request("/api/auth/login", { body }))).status).toBe(422);
  }
  expect(await database.client.session.count()).toBe(0);
});
it("changing the session secret invalidates existing sessions", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  const rotated = createAuthService({ client: database.client, config: { ...config, sessionSecret: "another-test-only-secret-".repeat(4) } });
  expect(await rotated.getActor(session.token, now)).toBeNull();
});

it("accepts an IP header only from the configured proxy secret", async () => {
  const secret = "test-proxy-only-secret-".repeat(4);
  const proxyConfig = { ...config, trustedProxySecret: secret };
  const proxyAuth = createAuthService({ client: database.client, config: proxyConfig });
  const proxyAuthorization = createAuthorization({ auth: proxyAuth, config: proxyConfig, now: () => now });
  const proxyHandlers = createAuthHandlers({ auth: proxyAuth, authorization: proxyAuthorization, config: proxyConfig, now: () => now });
  const login = (address: string, suppliedSecret: string, password: string) => proxyHandlers.login(request("/api/auth/login", { body: { username: "user", password }, headers: { "X-SFBB-Client-IP": address, "X-SFBB-Proxy-Secret": suppliedSecret } }));
  for (let i = 0; i < 5; i++) expect((await login("203.0.113.7", secret, "wrong")).status).toBe(401);
  expect((await login("203.0.113.7", secret, credentials.memberPassword)).status).toBe(429);
  expect((await login("203.0.113.8", secret, credentials.memberPassword)).status).toBe(200);
  for (let i = 0; i < 5; i++) expect((await login(`203.0.113.${i}`, "forged", "wrong")).status).toBe(401);
  expect((await login("203.0.113.99", "forged", credentials.memberPassword)).status).toBe(429);
});
it("rejects missing origin and forged mutation context", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  const mutation = request("/api/auth/logout", { token: session.token, csrf: session.csrfToken, method: "POST" });
  mutation.headers.delete("Origin");
  expect((await handlers.logout(mutation)).status).toBe(403);
  await expect(authorization.authorizeMutation(request("/api/auth/logout", { token: session.token, csrf: session.csrfToken, method: "POST" }), { actor: { role: "admin", sessionId: session.actor.sessionId }, now })).rejects.toMatchObject({ status: 401 });
});
it("rejects duplicate session cookies and does not return raw session tokens", async () => {
  const session = await auth.signIn("user", credentials.memberPassword, now);
  const response = await handlers.session(request("/api/auth/session", { token: session.token }));
  const payload = await response.json();
  expect(JSON.stringify(payload)).not.toContain(session.token);
  expect((await handlers.session(request("/api/auth/session", { headers: { Cookie: `${cookie(session.token)}; ${cookie(session.token)}` } }))).status).toBe(401);
});
