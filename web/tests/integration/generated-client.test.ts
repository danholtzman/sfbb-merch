import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("loads the generated client directly in Node 24 without a bundler", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", "import {PrismaClient} from './src/generated/prisma/client.ts'; console.log(typeof PrismaClient)"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  expect(output.trim()).toBe("function");
});
