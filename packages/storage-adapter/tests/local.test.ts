import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { LocalFileSystemAdapter } from "../src/adapters/local";
import { describeStorageConformance } from "./conformance";

// The default provider (ADR-021). Also the adapter for NFS, SMB/CIFS, EFS and
// any other network filesystem mounted as a directory: the code path is
// identical, so this suite is the verification for all of them.
describeStorageConformance("local filesystem (default; NFS/SMB mounts)", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "storage-local-"));
  return {
    adapter: new LocalFileSystemAdapter({ root }),
    teardown: async () => rmSync(root, { recursive: true, force: true }),
  };
});
