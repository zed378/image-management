import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createStorageAdapter } from "./factory";

import type { StorageConfig } from "@image-delivery/config";

// The factory is the only place a provider is chosen (ADR-021). Building an
// adapter must not connect anywhere: a misconfigured network provider is
// reported by /readyz, not by a crash at startup.

const CONFIGS: readonly StorageConfig[] = [
  { provider: "local", root: mkdtempSync(path.join(tmpdir(), "factory-")) },
  {
    provider: "s3",
    bucket: "images",
    region: "us-east-1",
    endpoint: "http://127.0.0.1:1",
    forcePathStyle: true,
    credentials: { accessKeyId: "id", secretAccessKey: "secret" },
  },
  {
    provider: "azure-blob",
    accountName: "devstoreaccount1",
    accountKey: Buffer.from("not-a-real-key").toString("base64"),
    container: "images",
    endpoint: "http://127.0.0.1:1/devstoreaccount1",
  },
  {
    provider: "sftp",
    host: "127.0.0.1",
    port: 1,
    username: "images",
    password: "pw",
    privateKey: undefined,
    root: "/",
    hostKeySha256: undefined,
  },
  {
    provider: "webdav",
    url: "http://127.0.0.1:1/dav",
    username: undefined,
    password: undefined,
    root: "/",
  },
];

describe("createStorageAdapter", () => {
  it.each(CONFIGS.map((c) => [c.provider, c] as const))(
    "builds the %s adapter without connecting",
    async (provider, config) => {
      const adapter = await createStorageAdapter(config);

      expect(adapter.provider).toBe(provider);
      await adapter.close();
    },
    // The first dynamic import of a provider SDK (Azure's is large) can take
    // several seconds while the whole suite runs in parallel; production pays
    // it once at startup.
    30_000,
  );
});
