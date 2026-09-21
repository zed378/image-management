import { describe, expect, it } from "vitest";

import {
  DECOY_HASH,
  displayPrefix,
  generateApiKey,
  hashApiKeySecret,
  parseApiKey,
  verifyApiKeySecret,
} from "./api-key.crypto";

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

describe("API key format", () => {
  it("round-trips a generated key through the parser", () => {
    const key = generateApiKey("live");

    expect(key.plaintext).toMatch(/^ak_live_[0-9A-HJKMNP-TV-Z]{26}_[A-Za-z0-9_-]{43}$/);
    expect(parseApiKey(key.plaintext)).toEqual({
      environment: "live",
      id: key.id,
      secret: key.secret,
    });
  });

  it("generates a different secret every time", () => {
    expect(generateApiKey("test").secret).not.toBe(generateApiKey("test").secret);
  });

  it.each([
    "",
    "ak_live_",
    "Bearer ak_live_x",
    "ak_prod_01HZZZZZZZZZZZZZZZZZZZZZZZ_" + "a".repeat(43),
    "ak_live_01HZZZZZZZZZZZZZZZZZZZZZZZ_" + "a".repeat(42),
    "ak_live_01HZZZZZZZZZZZZZZZZZZZZZZZ_" + "a".repeat(44),
    "ak_live_01hzzzzzzzzzzzzzzzzzzzzzzz_" + "a".repeat(43),
    "ak_live_01HZZZZZZZZZZZZZZZZZZZZZZZ_" + "a".repeat(42) + "=",
  ])("rejects a malformed key %j without throwing", (value) => {
    expect(parseApiKey(value)).toBeNull();
  });

  it("shows only the non-secret part as the prefix", () => {
    expect(displayPrefix("test", "01HZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(
      "ak_test_01HZZZZZZZZZZZZZZZZZZZZZZZ",
    );
  });
});

describe("API key hash", () => {
  it("is a 64-character hex HMAC, never the secret", () => {
    const key = generateApiKey("live");
    const hash = hashApiKeySecret(PEPPER, key.id, key.secret);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key.secret);
  });

  it("binds the id: the same secret under another id hashes differently", () => {
    expect(hashApiKeySecret(PEPPER, "A", "s")).not.toBe(hashApiKeySecret(PEPPER, "B", "s"));
  });

  it("depends on the pepper", () => {
    expect(hashApiKeySecret(PEPPER, "A", "s")).not.toBe(hashApiKeySecret(`${PEPPER}x`, "A", "s"));
  });

  it("verifies the right secret and rejects a wrong one", () => {
    const key = generateApiKey("live");
    const stored = hashApiKeySecret(PEPPER, key.id, key.secret);

    expect(verifyApiKeySecret(PEPPER, key.id, key.secret, stored)).toBe(true);
    expect(verifyApiKeySecret(PEPPER, key.id, `${key.secret.slice(0, -1)}x`, stored)).toBe(false);
  });

  it("rejects against the decoy and a corrupt stored hash", () => {
    expect(verifyApiKeySecret(PEPPER, "A", "s", DECOY_HASH)).toBe(false);
    expect(verifyApiKeySecret(PEPPER, "A", "s", "abc")).toBe(false);
  });
});
