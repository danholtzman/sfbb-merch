import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import SQLite from "better-sqlite3";
import nextEnv from "@next/env";

// Match the app's .env* loading and keep exported deployment values first.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:") || !isAbsolute(url.slice(5))) {
  throw new Error("DATABASE_URL must be an absolute SQLite file URL");
}
// Prisma 7's schema engine requires the file to exist. Opening SQLite creates
// an empty file if needed, without truncating a restored/existing database.
const connection = new SQLite(url.slice(5));
connection.close();
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "deploy",
], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: process.env, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
