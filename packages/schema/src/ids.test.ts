import { describe, expect, it } from "vitest";

import { isUlid, newId } from "./ids";

describe("newId", () => {
  it("produces a 26-character Crockford base32 ULID", () => {
    expect(newId()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("sorts in creation order, even within one millisecond", () => {
    const ids = Array.from({ length: 1_000 }, () => newId());

    expect([...ids].sort()).toEqual(ids);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId()));

    expect(ids.size).toBe(10_000);
  });
});

describe("isUlid", () => {
  it.each([
    ["a valid ULID", "01J8Z3K5M6N7P8Q9R0S1T2V3W4", true],
    ["lowercase", "01j8z3k5m6n7p8q9r0s1t2v3w4", false],
    ["too short", "01J8Z3K5M6N7P8Q9R0S1T2V3W", false],
    ["containing I, L, O or U", "01J8Z3K5M6N7P8Q9R0S1T2V3WU", false],
    ["a number", 42, false],
    ["path traversal", "../../etc/passwd/aaaaaaaaaa", false],
  ])("returns the right answer for %s", (_case, value, expected) => {
    expect(isUlid(value)).toBe(expected);
  });
});
