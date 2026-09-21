import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { GenericContainer, Wait } from "testcontainers";

import { describeStorageConformance } from "./conformance";
import { AzureBlobStorageAdapter } from "../src/adapters/azure-blob";

// Azure Blob Storage, against Azurite (Microsoft's official emulator). The
// account name and key are Azurite's published, well-known development
// credentials -- not a secret.
const ACCOUNT = "devstoreaccount1";
const KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
const CONTAINER = "image-delivery-test";

describeStorageConformance("azure-blob (Azurite)", async () => {
  const azurite = await new GenericContainer("mcr.microsoft.com/azure-storage/azurite:3.35.0")
    .withCommand(["azurite-blob", "--blobHost", "0.0.0.0", "--skipApiVersionCheck", "--loose"])
    .withExposedPorts(10000)
    .withWaitStrategy(Wait.forLogMessage(/Azurite Blob service successfully listens/))
    .start();
  const endpoint = `http://${azurite.getHost()}:${azurite.getMappedPort(10000)}/${ACCOUNT}`;
  await new BlobServiceClient(endpoint, new StorageSharedKeyCredential(ACCOUNT, KEY))
    .getContainerClient(CONTAINER)
    .createIfNotExists();

  return {
    adapter: new AzureBlobStorageAdapter({
      accountName: ACCOUNT,
      accountKey: KEY,
      container: CONTAINER,
      endpoint,
    }),
    teardown: async () => {
      await azurite.stop();
    },
  };
});
