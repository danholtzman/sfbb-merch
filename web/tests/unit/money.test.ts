import { describe, expect, it } from "vitest";
import { parseUsd, formatUsd } from "../../src/domain/money";
import { bandDate } from "../../src/domain/clock";

describe("USD integer cents", () => {
  it.each([["25.10", 2510], ["0", 0], ["0.01", 1], ["25.1", 2510], ["21474836.47", 2147483647]] as const)(
    "parses %s as %d", (text, cents) => expect(parseUsd(text)).toBe(cents),
  );
  it.each(["1.001", "-1", "NaN", "Infinity", "1e2", "", " 25 ", "21474836.48"])(
    "rejects %s", text => expect(() => parseUsd(text)).toThrow(),
  );
  it("formats cents without binary-float price arithmetic", () => {
    expect(formatUsd(2510)).toBe("$25.10");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1)).toBe("$0.01");
  });
  it.each([-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid cents %s", value => {
    expect(() => formatUsd(value)).toThrow();
  });
});

describe("band-local calendar date", () => {
  it.each([
    ["2026-10-15T06:59:59Z", "2026-10-14"],
    ["2026-10-15T07:00:00Z", "2026-10-15"],
    ["2026-12-01T07:59:59Z", "2026-11-30"],
    ["2026-12-01T08:00:00Z", "2026-12-01"],
    ["2026-03-08T09:59:59Z", "2026-03-08"],
    ["2026-03-08T10:00:00Z", "2026-03-08"],
  ])("maps %s to %s", (utc, date) => expect(bandDate(new Date(utc))).toBe(date));
  it("rejects invalid dates", () => expect(() => bandDate(new Date(NaN))).toThrow());
});
