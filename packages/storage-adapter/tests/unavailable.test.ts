import { describe, expect, it } from "vitest";

import { StorageUnavailableError, type StorageAdapter } from "../src";
import { AzureBlobStorageAdapter } from "../src/adapters/azure-blob";
import { S3StorageAdapter } from "../src/adapters/s3";
import { SftpStorageAdapter } from "../src/adapters/sftp";
import { WebDavStorageAdapter } from "../src/adapters/webdav";

// docs/STORAGE/01: a provider outage reaches the caller as
// StorageUnavailableError -- never as a raw SDK error (the abstraction would
// leak) and never as "not found" (a caller would treat an outage as a
// missing object: re-upload, 404 to a user, or a derivative regenerated
// against nothing). Port 1 on loopback refuses every connection.

const DEAD = "127.0.0.1:1";

const adapters: readonly (readonly [string, () => StorageAdapter])[] = [
  [
    "s3",
    () =>
      new S3StorageAdapter({
        bucket: "images",
        region: "us-east-1",
        endpoint: `http://${DEAD}`,
        forcePathStyle: true,
        credentials: { accessKeyId: "id", secretAccessKey: "secret" },
      }),
  ],
  [
    "azure-blob",
    () =>
      new AzureBlobStorageAdapter({
        accountName: "devstoreaccount1",
        accountKey: Buffer.from("not-a-real-key").toString("base64"),
        container: "images",
        endpoint: `http://${DEAD}/devstoreaccount1`,
      }),
  ],
  [
    "sftp",
    () =>
      new SftpStorageAdapter({
        host: "127.0.0.1",
        port: 1,
        username: "images",
        password: "pw",
        privateKey: undefined,
        root: "/",
        hostKeySha256: undefined,
      }),
  ],
  [
    "webdav",
    () =>
      new WebDavStorageAdapter({
        url: `http://${DEAD}/dav`,
        username: undefined,
        password: undefined,
        root: "/",
      }),
  ],
];

const operations: readonly (readonly [string, (a: StorageAdapter) => Promise<unknown>])[] = [
  ["put", (a) => a.put("a/b.txt", Buffer.from("x"), { contentType: "text/plain" })],
  ["get", (a) => a.get("a/b.txt")],
  ["stat", (a) => a.stat("a/b.txt")],
  ["exists", (a) => a.exists("a/b.txt")],
  ["delete", (a) => a.delete("a/b.txt")],
  ["copy", (a) => a.copy("a/b.txt", "a/c.txt")],
  ["list", (a) => a.list("a/")],
];

describe.each(adapters)("%s with the backend unreachable", (_provider, build) => {
  it.each(operations)(
    "%s rejects with StorageUnavailableError",
    async (_operation, run) => {
      const adapter = build();
      try {
        await expect(run(adapter)).rejects.toBeInstanceOf(StorageUnavailableError);
      } finally {
        await adapter.close();
      }
    },
    60_000,
  );
});
