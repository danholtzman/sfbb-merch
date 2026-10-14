import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
