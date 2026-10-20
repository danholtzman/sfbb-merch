import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db";

it("deploys the real migrations to an empty database twice without changing existing records", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sfbb-migration-"));
  const url = `file:${join(directory, "test.sqlite")}`;
  const client = createDatabase(url);
  const migrate = () => execFileSync(process.execPath, [resolve("scripts/migrate.mjs")], {
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    expect(migrate()).toContain("All migrations have been successfully applied");
    const season = await client.season.create({ data: { name: "Keep this", opensOn: "2026-10-01", closesOn: "2026-10-31" } });
    // Deployment stops the app before migrations; release its SQLite connection.
    await client.$disconnect();
    expect(migrate()).toContain("No pending migrations to apply");
    expect(await client.season.findMany()).toMatchObject([{ id: season.id, name: "Keep this" }]);
    await expect(client.$executeRaw`UPDATE "Season" SET lifecycle = 'UNKNOWN' WHERE id = ${season.id}`).rejects.toThrow();
  } finally { await client.$disconnect(); rmSync(directory, { recursive: true, force: true }); }
}, 15000);

it("loads DATABASE_URL from local env files while preserving an exported override", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sfbb-migration-env-"));
  const localUrl = `file:${join(directory, "local.sqlite")}`;
  const overrideUrl = `file:${join(directory, "override.sqlite")}`;
  const local = createDatabase(localUrl), override = createDatabase(overrideUrl);
  const script = resolve("scripts/migrate.mjs");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development", PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  delete env.DATABASE_URL;
  try {
    writeFileSync(join(directory, ".env"), "DATABASE_URL=file:relative-invalid.sqlite\n");
    writeFileSync(join(directory, ".env.local"), `DATABASE_URL="${localUrl}"\n`);
    const migrate = (extra = {}) => execFileSync(process.execPath, [script], { cwd: directory, env: { ...env, ...extra }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    expect(migrate()).toContain("All migrations have been successfully applied");
    expect(await local.season.count()).toBe(0);
    expect(migrate({ DATABASE_URL: overrideUrl })).toContain("All migrations have been successfully applied");
    expect(await override.season.count()).toBe(0);
  } finally { await local.$disconnect(); await override.$disconnect(); rmSync(directory, { recursive: true, force: true }); }
}, 15000);
