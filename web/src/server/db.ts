import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { AppError } from "../domain/errors";
import { bandDate } from "../domain/clock";
import { readConfig } from "./config";

export type DbTransaction = Prisma.TransactionClient;

/** Configure the adapter's actual connection before Prisma can run any query. */
class ConfiguredSqliteAdapter extends PrismaBetterSqlite3 {
  override async connect() {
    const adapter = await super.connect();
    try {
      await adapter.executeScript("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
      return adapter;
    } catch (error) { await adapter.dispose(); throw error; }
  }
}
const databaseKeys = new WeakMap<PrismaClient, string>();
export function createDatabase(url: string): PrismaClient {
  const client = new PrismaClient({ adapter: new ConfiguredSqliteAdapter({ url, timeout: 5000 }) });
  if (url !== ":memory:") databaseKeys.set(client, resolve(url.replace(/^file:/, "")));
  return client;
}

// Builds and public process health checks never read credentials or open storage.
const globalDatabase = globalThis as typeof globalThis & { sfbbDatabase?: PrismaClient };
function runtimeDatabase(): PrismaClient {
  return globalDatabase.sfbbDatabase ??= createDatabase(readConfig(process.env).databaseUrl);
}
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = runtimeDatabase();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// SQLite has one writer per file. Serialize interactive transactions even when
// separate clients share that file, avoiding busy waits while JS holds a lock.
const queues = new Map<string | PrismaClient, Promise<void>>();
export function withTransaction<T>(work: (tx: DbTransaction) => Promise<T>, client: PrismaClient = db): Promise<T> {
  const connection = client === db ? runtimeDatabase() : client;
  const key = databaseKeys.get(connection) ?? connection;
  const previous = queues.get(key) ?? Promise.resolve();
  const result = previous.then(() => connection.$transaction(work, { maxWait: 5000, timeout: 10000 }));
  const barrier = result.then(() => undefined, () => undefined);
  queues.set(key, barrier);
  void barrier.then(() => { if (queues.get(key) === barrier) queues.delete(key); });
  return result;
}
export function assertVersionWrite(count: number): void {
  if (count !== 1) throw new AppError("STALE_VERSION", 409, "This record changed. Reload it before saving.");
}

/** Explicit startup/bootstrap step after migrations; never run as an import side effect. */
export async function initializeDatabase(client: PrismaClient, now: Date): Promise<void> {
  const date = bandDate(now);
  await withTransaction(async tx => {
    if (await tx.initializationMarker.findUnique({ where: { key: "initial-season-v1" } })) return;
    // Preserve existing/operator-created data, including a restored database.
    if (await tx.season.count() === 0) {
      await tx.season.create({ data: {
        name: "First season", opensOn: date, closesOn: date, lifecycle: "DRAFT",
        artworkSets: { create: { name: "Season artwork", normalizedName: "season artwork" } },
      } });
    }
    await tx.initializationMarker.create({ data: { key: "initial-season-v1" } });
  }, client);
}
