import { afterEach, beforeEach, expect, it } from "vitest";
import { testDatabase, seedCatalog } from "../fixtures/database";
import { assertVersionWrite, createDatabase, initializeDatabase, withTransaction } from "../../src/server/db";

let database: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => { database = await testDatabase(); });
afterEach(async () => { await database?.close(); });

it("rolls back all writes when a multi-record operation fails", async () => {
  await expect(withTransaction(async tx => {
    const season = await tx.season.create({ data: { name: "Must roll back", opensOn: "2026-10-01", closesOn: "2026-10-31" } });
    await tx.artworkSet.create({ data: { seasonId: season.id, name: "Must roll back", normalizedName: "must roll back" } });
    throw new Error("Simulated failure");
  }, database.client)).rejects.toThrow("Simulated failure");
  expect(await database.client.season.count()).toBe(0);
  expect(await database.client.artworkSet.count()).toBe(0);
  const saved = await withTransaction(tx => tx.season.create({ data: { name: "Saved after rollback", opensOn: "2026-10-01", closesOn: "2026-10-31" } }), database.client);
  expect(await database.client.season.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ name: "Saved after rollback" });
});
it("rejects stale compare-and-increment writes without overwriting changes", async () => {
  const { season } = await seedCatalog(database.client);
  async function rename(name: string) {
    return withTransaction(async tx => {
      const write = await tx.season.updateMany({ where: { id: season.id, version: 1 }, data: { name, version: { increment: 1 } } });
      assertVersionWrite(write.count);
    }, database.client);
  }
  await rename("Saved version");
  await expect(rename("Stale version")).rejects.toMatchObject({ code: "STALE_VERSION", status: 409 });
  expect(await database.client.season.findUniqueOrThrow({ where: { id: season.id } })).toMatchObject({ name: "Saved version", version: 2 });
});
it("bootstraps one empty draft with paired asset slots once, including concurrent calls", async () => {
  await Promise.all([initializeDatabase(database.client, new Date("2026-10-15T06:00:00Z")), initializeDatabase(database.client, new Date("2026-10-15T06:00:00Z"))]);
  const season = await database.client.season.findFirstOrThrow();
  expect(season).toMatchObject({ name: "First season", opensOn: "2026-10-14", closesOn: "2026-10-14", lifecycle: "DRAFT" });
  expect(await database.client.season.count()).toBe(1);
  expect(await database.client.artworkSet.findMany()).toMatchObject([{ seasonId: season.id, frontAssetId: null, backAssetId: null }]);
  expect(await database.client.merchandiseStyle.count()).toBe(0);
  expect(await database.client.order.count()).toBe(0);
  await database.client.season.update({ where: { id: season.id }, data: { name: "My real season" } });
  await initializeDatabase(database.client, new Date("2027-01-01T00:00:00Z"));
  expect(await database.client.season.count()).toBe(1);
  expect(await database.client.season.findFirstOrThrow()).toMatchObject({ name: "My real season", opensOn: "2026-10-14" });
});
it("does not add sample records to an existing database", async () => {
  await seedCatalog(database.client);
  await initializeDatabase(database.client, new Date("2026-10-14T12:00:00Z"));
  expect(await database.client.season.findMany()).toMatchObject([{ name: "Test season" }]);
});

it("serializes bootstrap across two connections to the same file", async () => {
  const second = createDatabase(`file:${database.path}`);
  try {
    await Promise.all([
      initializeDatabase(database.client, new Date("2026-10-14T12:00:00Z")),
      initializeDatabase(second, new Date("2026-10-14T12:00:00Z")),
    ]);
    expect(await database.client.season.count()).toBe(1);
    expect(await database.client.initializationMarker.count()).toBe(1);
  } finally { await second.$disconnect(); }
}, 15000);
