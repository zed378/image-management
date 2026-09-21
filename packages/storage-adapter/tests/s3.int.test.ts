import { inject } from "vitest";

import { TEST_MINIO } from "@image-delivery/test-utils";

import { describeStorageConformance } from "./conformance";
import { S3StorageAdapter } from "../src/adapters/s3";

// S3-compatible object storage, against a real MinIO (P0-07 step 4). The same
// adapter serves AWS S3, Cloudflare R2, Wasabi, Backblaze B2, DigitalOcean
// Spaces, Ceph RGW, and GCS via its S3 interoperability endpoint.
describeStorageConformance("s3-compatible (MinIO)", async () => ({
  adapter: new S3StorageAdapter({
    bucket: TEST_MINIO.bucket,
    region: TEST_MINIO.region,
    endpoint: inject("s3Endpoint"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: TEST_MINIO.accessKeyId,
      secretAccessKey: TEST_MINIO.secretAccessKey,
    },
  }),
}));
