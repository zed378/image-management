// The StorageAdapter interface and every provider implementation (ADR-001,
// ADR-021, docs/STORAGE/01-STORAGE-ABSTRACTION.md). The only package that may
// import a storage provider SDK.
//
// The network adapters are NOT re-exported here: importing this barrel must
// not load the AWS, Azure, SSH or WebDAV clients. createStorageAdapter()
// loads the configured one lazily; code that needs a class directly imports
// the subpath (@image-delivery/storage-adapter/s3, /azure-blob, /sftp, /webdav).

export { LocalFileSystemAdapter, type LocalStorageOptions } from "./adapters/local";
export { MemoryStorageAdapter } from "./adapters/memory";
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
  derivativeObjectKey,
  derivativePrefix,
  EXTENSION_BY_FORMAT,
  EXTENSION_BY_MEDIA_TYPE,
  originalObjectKey,
  type DerivativeKeyParts,
  type OriginalKeyParts,
} from "./object-keys";
export {
  PROXY_PATH,
  createProxyToken,
  verifyProxyToken,
  withProxyPresign,
  type ProxyPresignOptions,
  type ProxyTokenPayload,
} from "./proxy-presign";
export type * from "./types";
