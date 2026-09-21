import { describe, expect, it } from "vitest";

import { StorageKeyError } from "./errors";
import { validateObjectKey, validatePrefix } from "./keys";

describe("validateObjectKey", () => {
  it.each([
    "01J8Z3K5M6N7P8Q9R0S1T2V3W4/01J8Z3K5M6N7P8Q9R0S1T2V3W5/originals/01J8Z3K5M6N7P8Q9R0S1T2V3W6/1.jpg",
    "tenant/project/derivatives/asset/3f7a9c.avif",
    "a",
    "a_b-c=d.e.f",
  ])("accepts %s", (key) => {
    expect(validateObjectKey(key)).toBe(key);
  });

  it("accepts a key of exactly 1024 characters and rejects 1025", () => {
    expect(() => validateObjectKey("a".repeat(1024))).not.toThrow();
    expect(() => validateObjectKey("a".repeat(1025))).toThrow(StorageKeyError);
  });

  it.each(["a b.jpg", "a/b?.jpg", "a/b#.jpg", "a/%2e%2e/b", "ä.jpg", "a/nul.txt", "a/LPT1"])("rejects %j", (key) => {
    expect(() => validateObjectKey(key)).toThrow(StorageKeyError);
  });
});

describe("validatePrefix", () => {
  it.each(["", "tenant/", "tenant/project/derivatives/asset/", "tenant/proj"])("accepts %j", (prefix) => {
    expect(validatePrefix(prefix)).toBe(prefix);
  });

  it.each(["../", "/", "a//", "a/../"])("rejects %j", (prefix) => {
    expect(() => validatePrefix(prefix)).toThrow(StorageKeyError);
  });
});
