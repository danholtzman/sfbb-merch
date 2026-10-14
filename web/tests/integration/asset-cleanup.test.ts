import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { writeFile, utimes, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { testDatabase, seedCatalog } from "../fixtures/database";
import { createAssetStore } from "../../src/features/artwork/assets";
it("cleanup is dry-run by default and preserves referenced/shared assets and recent in-flight orphans", async () => {
 const database = await testDatabase();
 try {
  const root = dirname(database.path), store = createAssetStore({ client: database.client, dataDir: root });
  const file = new File([new Uint8Array(await sharp({ create: { width: 10, height: 10, channels: 4, background: "transparent" } }).png().toBuffer())], "test.png", { type: "image/png" });
  const ctx = { actor: { role: "admin" as const, sessionId: randomUUID() }, now: new Date() };
  const retained = await store.storeImage(ctx, file, "artwork"), unused = await store.storeImage(ctx, file, "artwork"), recent = await store.storeImage(ctx, file, "artwork");
  const catalog = await seedCatalog(database.client);
  await database.client.artworkSet.update({ where: { id: catalog.artwork.id }, data: { frontAssetId: retained.id, backAssetId: retained.id } });
  await database.client.asset.updateMany({ where: { id: { in: [retained.id, unused.id] } }, data: { createdAt: new Date("2020-01-01") } });
  const orphan = join(root, "assets", `${randomUUID()}.png`); await writeFile(orphan, "orphan"); await utimes(orphan, new Date("2020-01-01"), new Date("2020-01-01"));
  const run = (args: string[]) => spawnSync(process.execPath, ["scripts/cleanup-assets.mjs", ...args], { encoding: "utf8", env: { ...process.env, DATA_DIR: root, DATABASE_URL: `file:${database.path}` } });
  expect(run([]).status).toBe(0);
  expect(await database.client.asset.count()).toBe(3);
  expect(run(["--apply"]).status).not.toBe(0);
  expect(run(["--apply", "--app-stopped"]).status).toBe(0);
  expect(await database.client.asset.findUnique({ where: { id: unused.id } })).toBeNull();
  expect(await database.client.asset.findUnique({ where: { id: recent.id } })).not.toBeNull();
  expect((await store.readAsset(retained.id)).bytes.length).toBeGreaterThan(0);
  await expect(readFile(orphan)).rejects.toMatchObject({ code: "ENOENT" });
 } finally { await database.close(); }
});
