// The StorageAdapter interface and every provider implementation (ADR-001,
// ADR-021, docs/STORAGE/01-STORAGE-ABSTRACTION.md). The only package that may
// import a storage provider SDK.

export { AzureBlobStorageAdapter, type AzureBlobStorageOptions } from "./adapters/azure-blob";
export { LocalFileSystemAdapter, type LocalStorageOptions } from "./adapters/local";
export { MemoryStorageAdapter } from "./adapters/memory";
export { S3StorageAdapter, type S3StorageOptions } from "./adapters/s3";
export { SftpStorageAdapter, type SftpStorageOptions } from "./adapters/sftp";
export { WebDavStorageAdapter, type WebDavStorageOptions } from "./adapters/webdav";
export { toBuffer, toReadable } from "./body";
export {
  StorageCapabilityError,
  StorageError,
  StorageKeyError,
  StorageNotFoundError,
  StorageTokenError,
  StorageUnavailableError,
} from "./errors";
export { createStorageAdapter } from "./factory";
export { validateObjectKey, validatePrefix } from "./keys";
export {
  PROXY_PATH,
  createProxyToken,
  verifyProxyToken,
  withProxyPresign,
  type ProxyPresignOptions,
  type ProxyTokenPayload,
} from "./proxy-presign";
export type * from "./types";
