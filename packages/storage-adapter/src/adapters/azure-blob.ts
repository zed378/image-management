import type { Readable } from "node:stream";

import {
  BlobSASPermissions,
  BlobServiceClient,
  RestError,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  type BlobItem,
  type ContainerClient,
} from "@azure/storage-blob";

import { clampListLimit, toReadable } from "../body";
import { StorageNotFoundError, StorageUnavailableError } from "../errors";
import { validateObjectKey, validatePrefix } from "../keys";
import type {
  GetResult,
  ListOptions,
  ListResult,
  ObjectBody,
  ObjectInfo,
  PresignGetOptions,
  PresignPutOptions,
  PresignedUrl,
  PutOptions,
  StorageAdapter,
} from "../types";

// Azure Blob Storage, which has no S3 API. Presigned URLs are Shared Access
// Signatures, which require the account key (a managed-identity deployment
// would use user-delegation SAS instead -- recorded as an open question in
// docs/STORAGE/10-STORAGE-PROVIDER-ADAPTER.md).

export type AzureBlobStorageOptions = {
  readonly accountName: string;
  readonly accountKey: string;
  readonly container: string;
  /** Omit for the public cloud; set for Azurite or sovereign clouds. */
  readonly endpoint?: string | undefined;
};

const isNotFound = (err: unknown): boolean => err instanceof RestError && err.statusCode === 404;

export class AzureBlobStorageAdapter implements StorageAdapter {
  readonly provider = "azure-blob" as const;
  readonly capabilities = { nativePresign: true } as const;
  private readonly container: ContainerClient;
  private readonly credential: StorageSharedKeyCredential;

  constructor(options: AzureBlobStorageOptions) {
    this.credential = new StorageSharedKeyCredential(options.accountName, options.accountKey);
    const endpoint = options.endpoint ?? `https://${options.accountName}.blob.core.windows.net`;
    this.container = new BlobServiceClient(endpoint, this.credential).getContainerClient(options.container);
  }

  private wrap(err: unknown, action: string, key: string): never {
    if (isNotFound(err)) throw new StorageNotFoundError(key, { cause: err });
    throw new StorageUnavailableError(`azure ${action} failed for ${key}`, { cause: err });
  }

  async put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo> {
    validateObjectKey(key);
    const blob = this.container.getBlockBlobClient(key);
    const headers = {
      blobContentType: options.contentType,
      ...(options.cacheControl ? { blobCacheControl: options.cacheControl } : {}),
    };
    try {
      // Block blob commits are atomic: the new content is visible only once
      // the block list is committed, never partially.
      if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
        await blob.uploadData(body, { blobHTTPHeaders: headers });
      } else {
        await blob.uploadStream(toReadable(body), 4 * 1024 * 1024, 4, { blobHTTPHeaders: headers });
      }
    } catch (err) {
      this.wrap(err, "put", key);
    }
    const info = await this.stat(key);
    if (!info) throw new StorageUnavailableError(`azure put produced no blob at ${key}`);
    return info;
  }

  async get(key: string): Promise<GetResult> {
    validateObjectKey(key);
    try {
      const res = await this.container.getBlobClient(key).download();
      if (!res.readableStreamBody) throw new StorageUnavailableError(`azure get returned no body for ${key}`);
      return {
        body: res.readableStreamBody as Readable,
        info: {
          key,
          byteSize: res.contentLength ?? 0,
          contentType: res.contentType ?? "application/octet-stream",
          lastModified: res.lastModified ?? new Date(0),
        },
      };
    } catch (err) {
      if (err instanceof StorageUnavailableError) throw err;
      this.wrap(err, "get", key);
    }
  }

  async stat(key: string): Promise<ObjectInfo | null> {
    validateObjectKey(key);
    try {
      const p = await this.container.getBlobClient(key).getProperties();
      return {
        key,
        byteSize: p.contentLength ?? 0,
        contentType: p.contentType ?? "application/octet-stream",
        lastModified: p.lastModified ?? new Date(0),
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw new StorageUnavailableError(`azure stat failed for ${key}`, { cause: err });
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    validateObjectKey(key);
    try {
      await this.container.getBlobClient(key).deleteIfExists();
    } catch (err) {
      this.wrap(err, "delete", key);
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo> {
    // Stream copy rather than a server-side copy-from-URL: it needs no SAS
    // for the source and behaves identically on Azurite and in the cloud.
    const source = await this.get(sourceKey);
    return this.put(destinationKey, source.body, { contentType: source.info.contentType });
  }

  async list(prefix: string, options: ListOptions = {}): Promise<ListResult> {
    validatePrefix(prefix);
    try {
      const page = await this.container
        .listBlobsFlat({ prefix })
        .byPage({
          maxPageSize: clampListLimit(options.limit),
          ...(options.cursor ? { continuationToken: options.cursor } : {}),
        })
        .next();
      const segment = page.value;
      if (page.done || !segment) return { objects: [], nextCursor: null };
      return {
        objects: segment.segment.blobItems.map((b: BlobItem) => ({
          key: b.name,
          byteSize: b.properties.contentLength ?? 0,
          contentType: b.properties.contentType ?? "application/octet-stream",
          lastModified: b.properties.lastModified,
        })),
        nextCursor: segment.continuationToken ? segment.continuationToken : null,
      };
    } catch (err) {
      throw new StorageUnavailableError(`azure list failed for prefix ${prefix}`, { cause: err });
    }
  }

  private sasUrl(key: string, permissions: string, expiresInSeconds: number, contentType?: string): string {
    const blob = this.container.getBlobClient(key);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.container.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse(permissions),
        // Allow for modest clock skew between us and Azure.
        startsOn: new Date(Date.now() - 60_000),
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
        ...(contentType ? { contentType } : {}),
      },
      this.credential,
    ).toString();
    return `${blob.url}?${sas}`;
  }

  async presignPut(key: string, options: PresignPutOptions): Promise<PresignedUrl> {
    validateObjectKey(key);
    return {
      url: this.sasUrl(key, "cw", options.expiresInSeconds),
      method: "PUT",
      headers: { "content-type": options.contentType, "x-ms-blob-type": "BlockBlob" },
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000),
      kind: "native",
    };
  }

  async presignGet(key: string, options: PresignGetOptions): Promise<PresignedUrl> {
    validateObjectKey(key);
    return {
      url: this.sasUrl(key, "r", options.expiresInSeconds),
      method: "GET",
      headers: {},
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000),
      kind: "native",
    };
  }

  async close(): Promise<void> {}
}
