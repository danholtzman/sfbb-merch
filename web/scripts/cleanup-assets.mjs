import SQLite from "better-sqlite3";
import { realpathSync, readdirSync, lstatSync, unlinkSync } from "node:fs";
import { isAbsolute, join } from "node:path";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if ([...args].some(arg => !["--apply", "--app-stopped"].includes(arg)) || (apply && !args.has("--app-stopped"))) {
 console.error("Stop the application first. Use --apply --app-stopped to delete, or no flags for a dry run."); process.exit(1);
}
const rootInput = process.env.DATA_DIR, url = process.env.DATABASE_URL;
if (!rootInput || !isAbsolute(rootInput) || !url?.startsWith("file:") || !isAbsolute(url.slice(5))) { console.error("Set absolute DATA_DIR and DATABASE_URL."); process.exit(1); }
const root = realpathSync(rootInput), folder = join(root, "assets");
if (realpathSync(folder) !== folder) throw new Error("Unsafe asset directory");
const database = new SQLite(url.slice(5), { fileMustExist: true });
database.pragma("foreign_keys = ON"); database.pragma("busy_timeout = 5000");
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
const safeKey = key => /^[a-f0-9-]{36}\.(png|jpg)$/.test(key);
const old = value => { const time = typeof value === "number" ? value : Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`); return Number.isFinite(time) && time < cutoff; };
try {
 database.exec("BEGIN IMMEDIATE");
 const assets = database.prepare("SELECT * FROM Asset").all();
 const referenced = new Set(database.prepare("SELECT frontAssetId AS id FROM ArtworkSet WHERE frontAssetId IS NOT NULL UNION SELECT backAssetId FROM ArtworkSet WHERE backAssetId IS NOT NULL UNION SELECT assetId FROM BlankPhoto").all().map(row => row.id));
 const unused = assets.filter(asset => !referenced.has(asset.id) && old(asset.createdAt) && safeKey(asset.storageKey));
 const known = new Set(assets.map(asset => asset.storageKey));
 const files = readdirSync(folder).filter(key => (safeKey(key) && !known.has(key)) || /^\.[a-f0-9-]{36}\.pending$/.test(key)).filter(key => { const stat = lstatSync(join(folder, key)); return stat.isFile() && stat.mtimeMs < cutoff; });
 if (apply) {
  for (const asset of unused) {
   try { const path = join(folder, asset.storageKey); const stat = lstatSync(path); if (!stat.isFile()) throw new Error("Unexpected asset file"); unlinkSync(path); }
   catch (error) { if (error.code !== "ENOENT") throw error; }
   database.prepare("DELETE FROM Asset WHERE id = ?").run(asset.id);
  }
  for (const key of files) unlinkSync(join(folder, key));
 }
 database.exec("COMMIT");
 console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", graceHours: 24, unreferencedAssets: unused.map(a => a.id), orphanFiles: files }, null, 2));
} catch (error) { if (database.inTransaction) database.exec("ROLLBACK"); throw error; }
finally { database.close(); }
