import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db";
import { testDatabase, seedCatalog, lineData } from "../fixtures/database";

let database: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => { database = await testDatabase(); });
afterEach(async () => { await database?.close(); });

describe("durable relational catalog and orders", () => {
  it("rejects references to missing parents", async () => {
    await expect(database.client.styleColor.create({ data: { styleId: "missing", name: "Blue", normalizedName: "blue", hex: "#1247ED", position: 0 } })).rejects.toThrow();
  });
  it("requires unique lookup codes", async () => {
    const { season } = await seedCatalog(database.client);
    await database.client.order.create({ data: { seasonId: season.id, fullName: "Alex Morgan", code: "BR4SS2" } });
    await expect(database.client.order.create({ data: { seasonId: season.id, fullName: "Other member", code: "BR4SS2" } })).rejects.toThrow();
  });
  it("keeps snapshots and prevents deletion of cancelled order variants", async () => {
    const c = await seedCatalog(database.client);
    const order = await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Alex Morgan", code: "BR4SS2", cancelled: true, lines: { create: lineData(c) } } });
    await database.client.styleColor.update({ where: { id: c.color.id }, data: { name: "Navy", normalizedName: "navy", hex: "#001122" } });
    await database.client.merchandiseStyle.update({ where: { id: c.style.id }, data: { name: "New name", unitPriceCents: 9900 } });
    await database.client.artworkSet.update({ where: { id: c.artwork.id }, data: { name: "New artwork name", normalizedName: "new artwork name" } });
    await database.client.styleSize.update({ where: { id: c.size.id }, data: { label: "XL", normalizedLabel: "xl" } });
    const line = await database.client.orderLine.findFirstOrThrow({ where: { orderId: order.id } });
    expect(line).toMatchObject({ styleName: "Classic Tee", artworkSetName: "Season artwork", sizeLabel: "L", colorName: "Blue", colorHex: "#1247ED", unitPriceCents: 2510 });
    for (const operation of [
      () => database.client.styleColor.delete({ where: { id: c.color.id } }),
      () => database.client.styleSize.delete({ where: { id: c.size.id } }),
      () => database.client.artworkSet.delete({ where: { id: c.artwork.id } }),
      () => database.client.merchandiseStyle.delete({ where: { id: c.style.id } }),
      () => database.client.season.delete({ where: { id: c.season.id } }),
    ]) await expect(operation()).rejects.toThrow();
  });
  it("rejects duplicate normalized color, size, and artwork names", async () => {
    const c = await seedCatalog(database.client);
    await expect(database.client.styleColor.create({ data: { styleId: c.style.id, name: "BLUE", normalizedName: "blue", hex: "#1247ED", position: 1 } })).rejects.toThrow();
    await expect(database.client.styleSize.create({ data: { styleId: c.style.id, label: "l", normalizedLabel: "l", position: 1 } })).rejects.toThrow();
    await expect(database.client.artworkSet.create({ data: { seasonId: c.season.id, name: "SEASON ARTWORK", normalizedName: "season artwork" } })).rejects.toThrow();
  });
  it("allows only one shared placement/photo per side and scope", async () => {
    const c = await seedCatalog(database.client);
    const placement = { styleId: c.style.id, artworkSetId: c.artwork.id, side: "front" as const, scopeKey: "all", x: 50, y: 47.7, width: 25, rotation: 0 };
    await database.client.placement.create({ data: placement });
    await expect(database.client.placement.create({ data: placement })).rejects.toThrow();
    await database.client.placement.create({ data: { ...placement, side: "back" } });
    await database.client.placement.create({ data: { ...placement, colorId: c.color.id, scopeKey: c.color.id } });
    await expect(database.client.placement.create({ data: { ...placement, scopeKey: "another" } })).rejects.toThrow();
    const asset = await database.client.asset.create({ data: { mime: "image/png", width: 320, height: 310, byteSize: 100, storageKey: "asset.png", sha256: "a".repeat(64) } });
    const photo = { styleId: c.style.id, side: "front" as const, scopeKey: "all", assetId: asset.id };
    await database.client.blankPhoto.create({ data: photo });
    await expect(database.client.blankPhoto.create({ data: photo })).rejects.toThrow();
  });
  it("enforces progress, lifecycle and positive quantity checks below Prisma", async () => {
    const c = await seedCatalog(database.client);
    const order = await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Alex", code: "BR4SS2", lines: { create: lineData(c) } } });
    await expect(database.client.$executeRaw`UPDATE "Order" SET progress = 'UNKNOWN' WHERE id = ${order.id}`).rejects.toThrow();
    await expect(database.client.$executeRaw`UPDATE "Season" SET lifecycle = 'UNKNOWN' WHERE id = ${c.season.id}`).rejects.toThrow();
    await expect(database.client.$executeRaw`UPDATE "OrderLine" SET quantity = 0 WHERE "orderId" = ${order.id}`).rejects.toThrow();
    await expect(database.client.$executeRaw`UPDATE "OrderLine" SET "unitPriceCents" = -1 WHERE "orderId" = ${order.id}`).rejects.toThrow();
  });
  it("initializes every real client with foreign keys, WAL and a busy timeout", async () => {
    const client = database.client;
    expect(await client.$queryRawUnsafe('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1n }]);
    expect(await client.$queryRawUnsafe('PRAGMA journal_mode')).toEqual([{ journal_mode: "wal" }]);
    expect(await client.$queryRawUnsafe('PRAGMA busy_timeout')).toEqual([{ timeout: 5000n }]);
  });
});

it("preserves orders, snapshots and cancellation across connection restarts", async () => {
  const c = await seedCatalog(database.client);
  await database.client.order.create({ data: { seasonId: c.season.id, fullName: "Alex Morgan", code: "BR4SS2", note: "See you at rehearsal", progress: "DELIVERED_UNPAID", cancelled: true, lines: { create: lineData(c) } } });
  await database.client.$disconnect();
  const restarted = createDatabase(`file:${database.path}`);
  try {
    const order = await restarted.order.findUniqueOrThrow({ where: { code: "BR4SS2" }, include: { lines: true } });
    expect(order).toMatchObject({ fullName: "Alex Morgan", note: "See you at rehearsal", progress: "DELIVERED_UNPAID", cancelled: true, lines: [{ quantity: 2, unitPriceCents: 2510, colorName: "Blue" }] });
  } finally { await restarted.$disconnect(); }
});
