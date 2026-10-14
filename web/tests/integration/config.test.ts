import { describe, expect, it } from "vitest";
import { readConfig } from "../../src/server/config";

const valid: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "file:/data/sfbb.sqlite",
  DATA_DIR: "/data",
  MEMBER_PASSWORD_HASH: "scrypt:" + "a".repeat(32) + ":" + "b".repeat(128),
  ADMIN_PASSWORD_HASH: "scrypt:" + "c".repeat(32) + ":" + "d".repeat(128),
  SESSION_SECRET: "a".repeat(64),
};

describe("runtime configuration", () => {
  it("uses the production origin and twelve-hour session default", () => {
    expect(readConfig(valid)).toMatchObject({
      publicOrigin: "https://sfbb.holtzman.io", sessionTtlSeconds: 43200, dataDir: "/data",
    });
  });
  it.each(["MEMBER_PASSWORD_HASH", "ADMIN_PASSWORD_HASH", "SESSION_SECRET", "DATABASE_URL"])(
    "rejects missing %s", (name) => {
      expect(() => readConfig({ ...valid, [name]: undefined })).toThrow(name);
    },
  );
  it("rejects a relative data directory", () => {
    expect(() => readConfig({ ...valid, DATA_DIR: "data" })).toThrow("DATA_DIR");
  });
  it("rejects plaintext credentials and short session secrets", () => {
    expect(() => readConfig({ ...valid, MEMBER_PASSWORD_HASH: "password" })).toThrow("MEMBER_PASSWORD_HASH");
    expect(() => readConfig({ ...valid, SESSION_SECRET: "short" })).toThrow("SESSION_SECRET");
  });
  it("rejects non-HTTPS production origins and origin paths", () => {
    expect(() => readConfig({ ...valid, PUBLIC_ORIGIN: "http://sfbb.holtzman.io" })).toThrow("PUBLIC_ORIGIN");
    expect(() => readConfig({ ...valid, PUBLIC_ORIGIN: "https://sfbb.holtzman.io/path" })).toThrow("PUBLIC_ORIGIN");
  });
  it("allows localhost HTTP only in development", () => {
    expect(readConfig({ ...valid, NODE_ENV: "development", PUBLIC_ORIGIN: "http://localhost:3000" }).publicOrigin)
      .toBe("http://localhost:3000");
    expect(() => readConfig({ ...valid, NODE_ENV: "development", PUBLIC_ORIGIN: "http://example.com" }))
      .toThrow("PUBLIC_ORIGIN");
  });
  it("validates an explicitly configured session lifetime", () => {
    expect(readConfig({ ...valid, SESSION_TTL_SECONDS: "3600" }).sessionTtlSeconds).toBe(3600);
    for (const value of ["0", "-1", "1.5", "abc"]) {
      expect(() => readConfig({ ...valid, SESSION_TTL_SECONDS: value })).toThrow("SESSION_TTL_SECONDS");
    }
  });
});
