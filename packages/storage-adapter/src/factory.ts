import type { StorageConfig } from "@image-delivery/config";

import { AzureBlobStorageAdapter } from "./adapters/azure-blob";
import { LocalFileSystemAdapter } from "./adapters/local";
import { S3StorageAdapter } from "./adapters/s3";
import { SftpStorageAdapter } from "./adapters/sftp";
import { WebDavStorageAdapter } from "./adapters/webdav";
import type { StorageAdapter } from "./types";

/** Build the adapter the configuration names. The only place providers are chosen. */
export const createStorageAdapter = (config: StorageConfig): StorageAdapter => {
  switch (config.provider) {
    case "local":
      return new LocalFileSystemAdapter({ root: config.root });
    case "s3":
      return new S3StorageAdapter(config);
    case "azure-blob":
      return new AzureBlobStorageAdapter(config);
    case "sftp":
      return new SftpStorageAdapter(config);
    case "webdav":
      return new WebDavStorageAdapter(config);
  }
};
