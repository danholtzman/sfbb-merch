import { isAbsolute } from "node:path";

export type AppConfig = {
  databaseUrl: string;
  dataDir: string;
  publicOrigin: string;
  memberPasswordHash: string;
  adminPasswordHash: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  trustedProxySecret?: string;
};

/** Called by server services at runtime, never while importing or building. */
export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value?.trim()) throw new Error(`Missing ${name}`);
    return value;
  };
  const dataDir = required("DATA_DIR");
  if (!isAbsolute(dataDir)) throw new Error("DATA_DIR must be absolute");
  const databaseUrl = required("DATABASE_URL");
  if (!databaseUrl.startsWith("file:") || !isAbsolute(databaseUrl.slice(5))) {
    throw new Error("DATABASE_URL must be an absolute SQLite file URL");
  }
  const passwordHash = (name: string): string => {
    const value = required(name);
    if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value)) {
      throw new Error(`${name} must be a scrypt credential hash`);
    }
    return value;
  };
  const memberPasswordHash = passwordHash("MEMBER_PASSWORD_HASH");
  const adminPasswordHash = passwordHash("ADMIN_PASSWORD_HASH");
  const sessionSecret = required("SESSION_SECRET");
  if (sessionSecret.length < 64) throw new Error("SESSION_SECRET must contain at least 64 characters");
  let origin: URL;
  try { origin = new URL(env.PUBLIC_ORIGIN ?? "https://sfbb.holtzman.io"); }
  catch { throw new Error("PUBLIC_ORIGIN must be a valid origin"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  const development = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(development && local && origin.protocol === "http:"))) {
    throw new Error("PUBLIC_ORIGIN must be HTTPS, or a local HTTP origin in development/test");
  }
  const lifetime = env.SESSION_TTL_SECONDS ?? "43200";
  const sessionTtlSeconds = Number(lifetime);
  if (!/^\d+$/.test(lifetime) || !Number.isSafeInteger(sessionTtlSeconds) || sessionTtlSeconds <= 0) {
    throw new Error("SESSION_TTL_SECONDS must be a positive integer");
  }
  const trustedProxySecret = env.TRUSTED_PROXY_SECRET || undefined;
  if (trustedProxySecret && trustedProxySecret.length < 64) throw new Error("TRUSTED_PROXY_SECRET must contain at least 64 characters");
  return { databaseUrl, dataDir, publicOrigin: origin.origin, memberPasswordHash,
    adminPasswordHash, sessionSecret, sessionTtlSeconds, trustedProxySecret };
}
