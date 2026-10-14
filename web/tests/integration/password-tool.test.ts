import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { createAuthService } from "../../src/features/auth/service";
import { readConfig } from "../../src/server/config";
import { testDatabase } from "../fixtures/database";

it("generates a salted password hash that the real authentication service accepts", async () => {
  const password = "Test-only-password-tool!";
  const hash = () => execFileSync(process.execPath, ["scripts/hash-password.mjs"], { input: password, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  const first = hash();
  expect(first).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  expect(hash()).not.toBe(first);
  const config = readConfig({ NODE_ENV: "production", DATABASE_URL: "file:/data/test.sqlite", DATA_DIR: "/data", MEMBER_PASSWORD_HASH: first, ADMIN_PASSWORD_HASH: first, SESSION_SECRET: "test-only-tool-session-secret-".repeat(4) });
  const database = await testDatabase();
  try {
    const auth = createAuthService({ client: database.client, config });
    expect((await auth.signIn("user", password, new Date())).actor.role).toBe("member");
  } finally { await database.close(); }
});
