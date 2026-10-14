import { expect, it } from "vitest";
import { GET } from "../../src/app/api/health/route";
it("health returns only status and never reads or exposes credentials", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { status: "ok" } });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
