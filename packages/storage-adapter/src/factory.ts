import { LocalFileSystemAdapter } from "./adapters/local";

import type { StorageAdapter } from "./types";
import type { StorageConfig } from "@image-delivery/config";

/**
 * Build the adapter the configuration names -- the only place a provider is
 * chosen. Network providers are imported lazily, so a deployment on local
 * disk never loads the AWS, Azure, SSH or WebDAV client libraries: faster
 * startup, less memory, and less third-party code in the process.
 */
export const createStorageAdapter = async (config: StorageConfig): Promise<StorageAdapter> => {
  switch (config.provider) {
    case "local":
      return new LocalFileSystemAdapter({ root: config.root });
    case "s3":
      return new (await import("./adapters/s3")).S3StorageAdapter(config);
    case "azure-blob":
      return new (await import("./adapters/azure-blob")).AzureBlobStorageAdapter(config);
    case "sftp":
      return new (await import("./adapters/sftp")).SftpStorageAdapter(config);
    case "webdav":
      return new (await import("./adapters/webdav")).WebDavStorageAdapter(config);
  }
};
