import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import SQLite from "better-sqlite3";
import { createDatabase } from "../../src/server/db";

export async function testDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "sfbb-test-"));
  const path = join(directory, "test.sqlite");
  const connection = new SQLite(path);
  try {
    const migrations = resolve("prisma/migrations");
    for (const name of readdirSync(migrations).filter(n => /^\d/.test(n)).sort()) {
      connection.exec(readFileSync(join(migrations, name, "migration.sql"), "utf8"));
    }
  } finally { connection.close(); }
  try {
    const client = createDatabase(`file:${path}`);
    await client.$connect();
    return { client, path, async close() { await client.$disconnect(); rmSync(directory, { recursive: true, force: true }); } };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}

export async function seedCatalog(client: ReturnType<typeof createDatabase>) {
  const season = await client.season.create({ data: { name: "Test season", opensOn: "2026-10-01", closesOn: "2026-10-31" } });
  const artwork = await client.artworkSet.create({ data: { seasonId: season.id, name: "Season artwork", normalizedName: "season artwork" } });
  const style = await client.merchandiseStyle.create({ data: { seasonId: season.id, name: "Classic Tee", description: "Cotton", unitPriceCents: 2510, cut: "classic" } });
  const color = await client.styleColor.create({ data: { styleId: style.id, name: "Blue", normalizedName: "blue", hex: "#1247ED", position: 0 } });
  const size = await client.styleSize.create({ data: { styleId: style.id, label: "L", normalizedLabel: "l", position: 0 } });
  await client.styleArtworkSet.create({ data: { styleId: style.id, artworkSetId: artwork.id, position: 0 } });
  return { season, artwork, style, color, size };
}

export function lineData(catalog: Awaited<ReturnType<typeof seedCatalog>>) {
  return { styleId: catalog.style.id, artworkSetId: catalog.artwork.id, colorId: catalog.color.id,
    sizeId: catalog.size.id, quantity: 2, unitPriceCents: 2510, position: 0,
    styleName: "Classic Tee", artworkSetName: "Season artwork", colorName: "Blue", colorHex: "#1247ED", sizeLabel: "L" };
}
