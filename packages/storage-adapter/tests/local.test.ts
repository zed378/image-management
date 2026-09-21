import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { describeStorageConformance } from "./conformance";
import { StorageUnavailableError } from "../src";
import { LocalFileSystemAdapter } from "../src/adapters/local";

// The default provider (ADR-021). Also the adapter for NFS, SMB/CIFS, EFS and
// any other network filesystem mounted as a directory: the code path is
// identical, so this suite is the verification for all of them.
describeStorageConformance("local filesystem (default; NFS/SMB mounts)", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "storage-local-"));
  return {
    adapter: new LocalFileSystemAdapter({ root }),
    teardown: async () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
});

// Behavior specific to the filesystem, beyond the shared contract.
describe("local filesystem specifics", () => {
  let root: string;
  let adapter: LocalFileSystemAdapter;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "storage-local-specific-"));
    adapter = new LocalFileSystemAdapter({ root });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const put = (key: string) => adapter.put(key, Buffer.from("x"), { contentType: "image/png" });

  it("does not report a directory as an object", async () => {
    await put("a/b.png");

    expect(await adapter.stat("a")).toBeNull();
  });

  it("reports a path below a file as absent, not as a failure", async () => {
    await put("a.png");

    expect(await adapter.stat("a.png/b")).toBeNull();
    expect(await adapter.list("a.png/")).toEqual({ objects: [], nextCursor: null });
  });

  it("falls back to application/octet-stream when the sidecar is gone", async () => {
    await put("a/b.png");
    rmSync(path.join(root, ".meta", "a", "b.png.json"));

    expect(await adapter.stat("a/b.png")).toMatchObject({
      contentType: "application/octet-stream",
    });
  });

  it("lists from the root for a prefix without a slash, hiding metadata and temp files", async () => {
    await put("photos/x.png");
    await put("photos/y.png");
    await put("other/z.png");
    writeFileSync(path.join(root, ".tmp-leftover"), "partial");

    const listed = await adapter.list("ph");

    expect(listed.objects.map((o) => o.key)).toEqual(["photos/x.png", "photos/y.png"]);
  });

  it("lists nothing under a prefix that does not exist", async () => {
    expect(await adapter.list("missing/")).toEqual({ objects: [], nextCursor: null });
  });

  it("surfaces an unusable root as StorageUnavailableError", async () => {
    const fileAsRoot = path.join(root, "not-a-directory");
    writeFileSync(fileAsRoot, "x");
    const broken = new LocalFileSystemAdapter({ root: fileAsRoot });

    await expect(
      broken.put("a/b.png", Buffer.from("x"), { contentType: "image/png" }),
    ).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});
