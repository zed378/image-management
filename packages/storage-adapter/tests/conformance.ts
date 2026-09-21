import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toBuffer } from "../src/body";
import { StorageKeyError, StorageNotFoundError } from "../src/errors";
import { verifyProxyToken, withProxyPresign } from "../src/proxy-presign";
import type { StorageAdapter } from "../src/types";

// THE definition of "a supported storage provider" (ADR-001, ADR-021).
// Every adapter runs this suite unmodified. If a provider cannot pass a
// case, the StorageAdapter contract changes and every adapter is updated --
// the suite is never weakened for one provider (docs/ENGINEERING/09).

export type ConformanceHarness = {
  readonly adapter: StorageAdapter;
  readonly teardown?: () => Promise<void>;
};

const PROXY_SECRET = "conformance-proxy-secret-0123456789abcdef";

export const describeStorageConformance = (name: string, setup: () => Promise<ConformanceHarness>): void => {
  describe(`StorageAdapter conformance: ${name}`, () => {
    let h: ConformanceHarness;
    let adapter: StorageAdapter;
    // Every test works under its own prefix, so cases never see each other's objects.
    const ns = (suffix: string): string => `conf-${randomBytes(4).toString("hex")}/${suffix}`;

    beforeAll(async () => {
      h = await setup();
      adapter = h.adapter;
    });
    afterAll(async () => {
      // Guarded: if setup itself failed, there is nothing to close.
      await adapter?.close();
      await h?.teardown?.();
    });

    it("round-trips bytes and content type through put/get", async () => {
      const key = ns("a/original.jpg");
      const bytes = randomBytes(2048);

      const put = await adapter.put(key, bytes, { contentType: "image/jpeg" });
      const got = await adapter.get(key);

      expect(put).toMatchObject({ key, byteSize: 2048, contentType: "image/jpeg" });
      expect(got.info).toMatchObject({ key, byteSize: 2048, contentType: "image/jpeg" });
      expect(Buffer.compare(await toBuffer(got.body), bytes)).toBe(0);
    });

    it("accepts a stream of unknown length", async () => {
      const key = ns("stream.bin");
      const bytes = randomBytes(3 * 1024 * 1024 + 17);

      await adapter.put(key, Readable.from([bytes.subarray(0, 1_000_000), bytes.subarray(1_000_000)]), {
        contentType: "application/octet-stream",
      });

      const got = await adapter.get(key);
      expect(got.info.byteSize).toBe(bytes.length);
      expect(Buffer.compare(await toBuffer(got.body), bytes)).toBe(0);
    });

    it("overwrites an existing object", async () => {
      const key = ns("overwrite.png");
      await adapter.put(key, Buffer.from("first"), { contentType: "image/png" });

      await adapter.put(key, Buffer.from("second, longer"), { contentType: "image/webp" });

      const got = await adapter.get(key);
      expect((await toBuffer(got.body)).toString()).toBe("second, longer");
      expect(got.info.contentType).toBe("image/webp");
    });

    it("never exposes a partial object to a concurrent reader of an overwrite", async () => {
      const key = ns("atomic.bin");
      const a = Buffer.alloc(512 * 1024, 0x61);
      const b = Buffer.alloc(512 * 1024, 0x62);
      await adapter.put(key, a, { contentType: "application/octet-stream" });

      const reads: Buffer[] = [];
      const writer = adapter.put(key, b, { contentType: "application/octet-stream" });
      for (let i = 0; i < 3; i++) reads.push(await toBuffer((await adapter.get(key)).body));
      await writer;
      reads.push(await toBuffer((await adapter.get(key)).body));

      for (const r of reads) {
        expect(r.length).toBe(a.length);
        expect(r.equals(a) || r.equals(b)).toBe(true);
      }
    });

    it("throws StorageNotFoundError for a missing object", async () => {
      await expect(adapter.get(ns("missing.jpg"))).rejects.toBeInstanceOf(StorageNotFoundError);
    });

    it("reports existence and metadata through exists/stat", async () => {
      const key = ns("stat.avif");
      expect(await adapter.exists(key)).toBe(false);
      expect(await adapter.stat(key)).toBeNull();

      await adapter.put(key, Buffer.from("xyz"), { contentType: "image/avif" });

      expect(await adapter.exists(key)).toBe(true);
      expect(await adapter.stat(key)).toMatchObject({ key, byteSize: 3, contentType: "image/avif" });
    });

    it("deletes idempotently", async () => {
      const key = ns("delete.jpg");
      await adapter.put(key, Buffer.from("x"), { contentType: "image/jpeg" });

      await adapter.delete(key);
      await adapter.delete(key);

      expect(await adapter.exists(key)).toBe(false);
    });

    it("copies to an independent object", async () => {
      const source = ns("copy/source.jpg");
      const destination = ns("copy/destination.jpg");
      await adapter.put(source, Buffer.from("original bytes"), { contentType: "image/jpeg" });

      const info = await adapter.copy(source, destination);
      await adapter.delete(source);

      expect(info).toMatchObject({ key: destination, byteSize: 14, contentType: "image/jpeg" });
      expect((await toBuffer((await adapter.get(destination)).body)).toString()).toBe("original bytes");
    });

    it("lists only keys under a prefix, sorted, across every page", async () => {
      const base = ns("list");
      const keys = Array.from({ length: 7 }, (_, i) => `${base}/item-${String(i).padStart(2, "0")}.jpg`);
      for (const key of [...keys].reverse()) await adapter.put(key, Buffer.from(key), { contentType: "image/jpeg" });
      await adapter.put(`${base}-sibling/not-me.jpg`, Buffer.from("x"), { contentType: "image/jpeg" });

      const seen: string[] = [];
      let cursor: string | undefined;
      for (let pages = 0; pages < 10; pages++) {
        const page = await adapter.list(`${base}/`, { limit: 3, ...(cursor ? { cursor } : {}) });
        expect(page.objects.length).toBeLessThanOrEqual(3);
        seen.push(...page.objects.map((o) => o.key));
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }

      expect(seen).toEqual(keys);
    });

    it("returns an empty listing for a prefix with no objects", async () => {
      expect(await adapter.list(ns("empty/"))).toEqual({ objects: [], nextCursor: null });
    });

    it.each([
      ["parent traversal", "../escape.jpg"],
      ["nested traversal", "a/../../escape.jpg"],
      ["absolute path", "/etc/passwd"],
      ["backslash", "a\\b.jpg"],
      ["empty segment", "a//b.jpg"],
      ["trailing slash", "a/b/"],
      ["hidden segment", "a/.meta/b.json"],
      ["windows device name", "a/CON.jpg"],
      ["colon (NTFS stream)", "a/b.jpg:hidden"],
      ["control character", "a/b\u0000.jpg"],
      ["empty key", ""],
    ])("rejects a %s key before touching the backend", async (_case, key) => {
      await expect(adapter.put(key, Buffer.from("x"), { contentType: "image/jpeg" })).rejects.toBeInstanceOf(
        StorageKeyError,
      );
      await expect(adapter.get(key)).rejects.toBeInstanceOf(StorageKeyError);
    });

    describe("presigned URLs", () => {
      it("upload and download through a presigned URL pair", async () => {
        const presigning = withProxyPresign(adapter, { baseUrl: "https://api.example.test", secret: PROXY_SECRET });
        const key = ns("presigned.jpg");
        const put = await presigning.presignPut(key, { expiresInSeconds: 300, contentType: "image/jpeg", maxBytes: 1024 });
        const get = await presigning.presignGet(key, { expiresInSeconds: 300 });

        expect(put.kind).toBe(adapter.capabilities.nativePresign ? "native" : "proxy");
        expect(put.method).toBe("PUT");
        expect(get.method).toBe("GET");

        if (put.kind === "native") {
          const up = await fetch(put.url, { method: "PUT", headers: put.headers, body: Buffer.from("via url") });
          expect(up.ok).toBe(true);
          const down = await fetch(get.url);
          expect(await down.text()).toBe("via url");
        } else {
          // The proxy endpoint itself is served by the api (P2-03); here the
          // token is verified as that endpoint will verify it.
          const putToken = put.url.split("/").at(-1) ?? "";
          const payload = verifyProxyToken(putToken, "PUT", PROXY_SECRET);
          expect(payload).toMatchObject({ k: key, m: "PUT", ct: "image/jpeg", max: 1024 });
          expect(() => verifyProxyToken(putToken, "GET", PROXY_SECRET)).toThrow(/different method/);
        }
      });

      it("refuses a native URL once expired, or a proxy token past its expiry", async () => {
        const presigning = withProxyPresign(adapter, { baseUrl: "https://api.example.test", secret: PROXY_SECRET });
        const key = ns("expiring.jpg");
        await adapter.put(key, Buffer.from("secret"), { contentType: "image/jpeg" });

        const get = await presigning.presignGet(key, { expiresInSeconds: 1 });
        await new Promise((r) => setTimeout(r, 2_200));

        if (get.kind === "native") {
          const res = await fetch(get.url);
          expect(res.status).toBeGreaterThanOrEqual(400);
        } else {
          expect(() => verifyProxyToken(get.url.split("/").at(-1) ?? "", "GET", PROXY_SECRET)).toThrow(/expired/);
        }
      });
    });
  });
};
