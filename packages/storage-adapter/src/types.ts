import type { Readable } from "node:stream";

// The StorageAdapter contract (ADR-001, docs/STORAGE/01-STORAGE-ABSTRACTION.md).
// Every provider implements exactly this, and passes the same conformance
// suite unmodified (packages/storage-adapter/tests/conformance.ts).

export type StorageProviderName = "local" | "s3" | "azure-blob" | "sftp" | "webdav" | "memory";

export type ObjectBody = Readable | Buffer | Uint8Array;

export type PutOptions = {
  readonly contentType: string;
  /** Sent to object stores that support it; ignored by filesystem backends. */
  readonly cacheControl?: string;
};

export type ObjectInfo = {
  readonly key: string;
  readonly byteSize: number;
  readonly contentType: string;
  readonly lastModified: Date;
};

export type GetResult = {
  readonly body: Readable;
  readonly info: ObjectInfo;
};

export type ListOptions = {
  /** Opaque token from a previous page's `nextCursor`. */
  readonly cursor?: string | undefined;
  /** 1-1000. Default 1000. */
  readonly limit?: number;
};

export type ListResult = {
  /** Sorted by key ascending. */
  readonly objects: readonly ObjectInfo[];
  /** Opaque; null when there are no more objects. Never assume its format. */
  readonly nextCursor: string | null;
};

export type PresignPutOptions = {
  readonly expiresInSeconds: number;
  readonly contentType: string;
  /** Enforced by platform-proxied URLs; object stores check it after upload. */
  readonly maxBytes?: number;
};

export type PresignGetOptions = {
  readonly expiresInSeconds: number;
};

export type PresignedUrl = {
  readonly url: string;
  readonly method: "PUT" | "GET";
  /** Headers the client MUST send with the request, or it will be rejected. */
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
  /** `native`: the storage provider verifies it. `proxy`: the platform does. */
  readonly kind: "native" | "proxy";
};

export type StorageCapabilities = {
  /** The provider itself can issue time-limited upload/download URLs. */
  readonly nativePresign: boolean;
};

export interface StorageAdapter {
  readonly provider: StorageProviderName;
  readonly capabilities: StorageCapabilities;

  /** Write an object atomically: a concurrent reader sees the old or the new object, never a mix. */
  put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo>;
  /** Throws StorageNotFoundError when absent. */
  get(key: string): Promise<GetResult>;
  /** null when absent. */
  stat(key: string): Promise<ObjectInfo | null>;
  exists(key: string): Promise<boolean>;
  /** Idempotent: deleting an absent object succeeds. */
  delete(key: string): Promise<void>;
  /** Independent copy: deleting the source leaves the copy intact. */
  copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo>;
  list(prefix: string, options?: ListOptions): Promise<ListResult>;
  /** Throws StorageCapabilityError unless capabilities.nativePresign. */
  presignPut(key: string, options: PresignPutOptions): Promise<PresignedUrl>;
  /** Throws StorageCapabilityError unless capabilities.nativePresign. */
  presignGet(key: string, options: PresignGetOptions): Promise<PresignedUrl>;
  /** Release connections. Safe to call more than once. */
  close(): Promise<void>;
}
