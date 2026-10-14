import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";

const password = readFileSync(0, "utf8");
if (!password || password.length > 1024 || /[\r\n]/.test(password)) {
  throw new Error("Provide a password of 1–1024 characters via standard input, without a trailing newline.");
}
const salt = randomBytes(16);
const derived = scryptSync(password, salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${derived.toString("hex")}`);
