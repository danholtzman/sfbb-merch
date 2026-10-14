import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PrismaClient } from "../../generated/prisma/client";
import type { Actor } from "../../domain/types";
import { AppError } from "../../domain/errors";
import { db, withTransaction } from "../../server/db";
import { readConfig, type AppConfig } from "../../server/config";
import { clearFailures, isRateLimited, recordFailure } from "../../server/rate-limit";

const derivePassword = promisify(scrypt);
const credentialsError = () => new AppError("INVALID_CREDENTIALS", 401, "Username or password is incorrect. Please try again.");
export function digest(text: string): string { return createHash("sha256").update(text).digest("hex"); }
export function equalHex(first: string, second: string): boolean {
  return /^[a-f0-9]{64}$/.test(first) && /^[a-f0-9]{64}$/.test(second) && timingSafeEqual(Buffer.from(first, "hex"), Buffer.from(second, "hex"));
}
export function createAuthService({ client, config }: { client: PrismaClient; config: AppConfig }) {
  const keyedHash = (purpose: string, value: string) => createHmac("sha256", config.sessionSecret).update(`${purpose}:${value}`).digest("hex");
  const tokenHash = (token: string) => keyedHash("session", token);
  const csrfToken = (token: string) => keyedHash("csrf", token);
  async function signIn(username: string, password: string, now: Date, clientAddress = "untrusted") {
    if (!Number.isFinite(now.getTime())) throw new AppError("INVALID_DATE", 422, "Invalid server time.");
    const name = username.trim().toLowerCase();
    const role = name === "user" ? "member" : name === "admin" ? "admin" : null;
    const bucketKey = keyedHash("login", `${role ? name : "unknown"}:${clientAddress}`);
    // Commit failure counts before throwing, rather than rolling them back with the error.
    const outcome = await withTransaction(async tx => {
      if (await isRateLimited(tx, bucketKey, now, 5)) return { error: new AppError("LOGIN_THROTTLED", 429, "Too many attempts. Please try again in 15 minutes.") };
      const encoded = role === "admin" ? config.adminPasswordHash : config.memberPasswordHash;
      const [, saltHex, expectedHex] = encoded.split(":");
      const boundedPassword = password.length <= 1024 ? password : "invalid oversized input";
      const derived = await derivePassword(boundedPassword, Buffer.from(saltHex, "hex"), 64) as Buffer;
      const verified = timingSafeEqual(derived, Buffer.from(expectedHex, "hex"));
      if (!role || !verified || !password || password.length > 1024) {
        await recordFailure(tx, bucketKey, now, 15 * 60 * 1000);
        return { error: credentialsError() };
      }
      await clearFailures(tx, bucketKey);
      const token = randomBytes(32).toString("base64url");
      const csrf = csrfToken(token);
      const session = await tx.session.create({ data: { tokenHash: tokenHash(token), csrfTokenHash: digest(csrf), role, expiresAt: new Date(now.getTime() + config.sessionTtlSeconds * 1000) } });
      return { token, actor: { role: session.role, sessionId: session.id } satisfies Actor, csrfToken: csrf };
    }, client);
    if (outcome.error) throw outcome.error;
    return { token: outcome.token!, actor: outcome.actor!, csrfToken: outcome.csrfToken! };
  }
  async function getSession(token: string | undefined, now: Date) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !Number.isFinite(now.getTime())) return null;
    return client.session.findFirst({ where: { tokenHash: tokenHash(token), expiresAt: { gt: now } } });
  }
  async function getActor(token: string | undefined, now: Date): Promise<Actor | null> {
    const session = await getSession(token, now);
    return session ? { role: session.role, sessionId: session.id } : null;
  }
  async function signOut(token: string): Promise<void> {
    await withTransaction(tx => tx.session.deleteMany({ where: { tokenHash: tokenHash(token) } }).then(() => undefined), client);
  }
  return { signIn, getActor, getSession, signOut, csrfToken };
}
export type AuthService = ReturnType<typeof createAuthService>;
export function runtimeAuth(): AuthService { return createAuthService({ client: db, config: readConfig(process.env) }); }
export async function signIn(username: string, password: string, now: Date) { return runtimeAuth().signIn(username, password, now); }
export async function getActor(token: string | undefined, now: Date): Promise<Actor | null> { return runtimeAuth().getActor(token, now); }
export async function signOut(token: string): Promise<void> { await runtimeAuth().signOut(token); }
