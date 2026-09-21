import { describe, expect, it } from "vitest";

import { MemoryStorageAdapter } from "./adapters/memory";
import { StorageKeyError, StorageTokenError } from "./errors";
import { createProxyToken, verifyProxyToken, withProxyPresign } from "./proxy-presign";

const SECRET = "unit-test-proxy-secret-0123456789abcdef";
const NOW = new Date("2026-09-21T10:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const valid = {
  k: "t/p/originals/a/1.jpg",
  m: "PUT" as const,
  e: nowSeconds + 60,
  ct: "image/jpeg",
  max: 1024,
};

describe("verifyProxyToken", () => {
  it("returns the payload of a valid token", () => {
    expect(verifyProxyToken(createProxyToken(valid, SECRET), "PUT", SECRET, NOW)).toEqual(valid);
  });

  it("rejects a token signed with another secret", () => {
    const token = createProxyToken(valid, "a-completely-different-secret-value-000");

    expect(() => verifyProxyToken(token, "PUT", SECRET, NOW)).toThrow(StorageTokenError);
  });

  it("rejects a token whose payload was edited to point at another key", () => {
    const [, signature] = createProxyToken(valid, SECRET).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...valid, k: "other-tenant/p/originals/a/1.jpg" }),
    ).toString("base64url");

    expect(() => verifyProxyToken(`${forged}.${signature}`, "PUT", SECRET, NOW)).toThrow(
      /signature/,
    );
  });

  it("rejects a token whose size limit was raised", () => {
    const [, signature] = createProxyToken(valid, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ ...valid, max: 10 ** 12 })).toString("base64url");

    expect(() => verifyProxyToken(`${forged}.${signature}`, "PUT", SECRET, NOW)).toThrow(
      /signature/,
    );
  });

  it("rejects a token used for another method", () => {
    expect(() => verifyProxyToken(createProxyToken(valid, SECRET), "GET", SECRET, NOW)).toThrow(
      /different method/,
    );
  });

  it("rejects an expired token", () => {
    const token = createProxyToken({ ...valid, e: nowSeconds - 1 }, SECRET);

    expect(() => verifyProxyToken(token, "PUT", SECRET, NOW)).toThrow(/expired/);
  });

  it("rejects a token expiring exactly now", () => {
    const token = createProxyToken({ ...valid, e: nowSeconds }, SECRET);

    expect(() => verifyProxyToken(token, "PUT", SECRET, NOW)).toThrow(/expired/);
  });

  it("rejects a validly signed token carrying an unsafe key", () => {
    const token = createProxyToken({ ...valid, k: "../../etc/passwd" }, SECRET);

    expect(() => verifyProxyToken(token, "PUT", SECRET, NOW)).toThrow(StorageKeyError);
  });

  it.each(["", "abc", "a.b.c", ".sig", "payload."])("rejects the malformed token %j", (token) => {
    expect(() => verifyProxyToken(token, "PUT", SECRET, NOW)).toThrow(StorageTokenError);
  });
});

describe("withProxyPresign", () => {
  const presigning = withProxyPresign(new MemoryStorageAdapter(), {
    baseUrl: "https://api.example.test/",
    secret: SECRET,
    now: () => NOW,
  });

  it("issues a proxy PUT URL on the platform's own host", async () => {
    const put = await presigning.presignPut("t/p/a.jpg", {
      expiresInSeconds: 300,
      contentType: "image/jpeg",
    });

    expect(put.kind).toBe("proxy");
    expect(put.url).toMatch(/^https:\/\/api\.example\.test\/v1\/storage\/proxy\/[\w-]+\.[\w-]+$/);
    expect(put.headers).toEqual({ "content-type": "image/jpeg" });
    expect(put.expiresAt.toISOString()).toBe("2026-09-21T10:05:00.000Z");
  });

  it("validates the key before signing anything", async () => {
    await expect(presigning.presignGet("../x", { expiresInSeconds: 60 })).rejects.toBeInstanceOf(
      StorageKeyError,
    );
  });

  it("refuses a secret shorter than 32 bytes", () => {
    expect(() =>
      withProxyPresign(new MemoryStorageAdapter(), { baseUrl: "https://x", secret: "short" }),
    ).toThrow(/at least 32 bytes/);
  });
});
