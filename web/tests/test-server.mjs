import { scryptSync } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import credentials from "./fixtures/credentials.json" with { type: "json" };

const directory = mkdtempSync(join(tmpdir(), "sfbb-e2e-"));
const hash = password => { const salt = Buffer.alloc(16, 23); return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`; };
const env = { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1", DATA_DIR: directory,
  DATABASE_URL: `file:${join(directory, "test.sqlite")}`, PUBLIC_ORIGIN: "http://127.0.0.1:3100",
  MEMBER_PASSWORD_HASH: hash(credentials.memberPassword), ADMIN_PASSWORD_HASH: hash(credentials.adminPassword),
  SESSION_SECRET: "e2e-only-private-session-secret-".repeat(4), TRUSTED_PROXY_SECRET: "", SESSION_TTL_SECONDS: "43200" };
process.on("exit", () => rmSync(directory, { recursive: true, force: true }));
const migration = spawnSync(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "inherit" });
if (migration.status !== 0) process.exit(1);
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => next.kill("SIGTERM"));
next.once("exit", code => process.exit(code ?? 0));
