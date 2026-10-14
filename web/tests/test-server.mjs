import SQLite from "better-sqlite3";
import { randomUUID, scryptSync } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import credentials from "./fixtures/credentials.json" with { type: "json" };

// A fresh dev output prevents persisted HMR state from repeatedly reloading login
// after a production build. Only disposable generated development output is removed.
rmSync(".next/dev", { recursive: true, force: true });
const directory = mkdtempSync(join(tmpdir(), "sfbb-e2e-"));
const hash = password => { const salt = Buffer.alloc(16, 23); return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`; };
const env = { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1", DATA_DIR: directory,
  DATABASE_URL: `file:${join(directory, "test.sqlite")}`, PUBLIC_ORIGIN: "http://127.0.0.1:3100",
  MEMBER_PASSWORD_HASH: hash(credentials.memberPassword), ADMIN_PASSWORD_HASH: hash(credentials.adminPassword),
  SESSION_SECRET: "e2e-only-private-session-secret-".repeat(4), TRUSTED_PROXY_SECRET: "", SESSION_TTL_SECONDS: "43200" };
process.on("exit", () => rmSync(directory, { recursive: true, force: true }));
const migration = spawnSync(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "inherit" });
if (migration.status !== 0) process.exit(1);
// A single disposable incomplete catalog exercises publication messages; production
// initialization remains empty and never includes this fixture.
const fixture = new SQLite(join(directory, "test.sqlite"));
fixture.pragma("foreign_keys = ON");
const seasonId = randomUUID(), styleId = randomUUID(), setId = randomUUID();
fixture.transaction(() => {
  fixture.prepare('INSERT INTO Season (id,name,opensOn,closesOn,updatedAt) VALUES (?,?,?,?,?)').run(seasonId, "First season", "2026-10-01", "2026-10-31", Date.now());
  fixture.prepare('INSERT INTO ArtworkSet (id,seasonId,name,normalizedName,updatedAt) VALUES (?,?,?,?,?)').run(setId, seasonId, "Season artwork", "season artwork", Date.now());
  fixture.prepare('INSERT INTO MerchandiseStyle (id,seasonId,name,description,unitPriceCents,cut,updatedAt) VALUES (?,?,?,?,?,?,?)').run(styleId, seasonId, "Browser test tee", "Cotton", 2500, "classic", Date.now());
  fixture.prepare('INSERT INTO StyleColor (id,styleId,name,normalizedName,hex,position) VALUES (?,?,?,?,?,?)').run(randomUUID(), styleId, "Blue", "blue", "#1247ED", 0);
  fixture.prepare('INSERT INTO StyleSize (id,styleId,label,normalizedLabel,position) VALUES (?,?,?,?,?)').run(randomUUID(), styleId, "L", "l", 0);
  fixture.prepare('INSERT INTO StyleArtworkSet (id,styleId,artworkSetId,position) VALUES (?,?,?,?)').run(randomUUID(), styleId, setId, 0);
})();
fixture.close();
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => next.kill("SIGTERM"));
next.once("exit", code => process.exit(code ?? 0));
