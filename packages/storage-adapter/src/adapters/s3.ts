import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ByteCounter, clampListLimit, toReadable } from "../body";
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
import type { Readable } from "node:stream";

// Any S3-compatible object store: AWS S3, Cloudflare R2, MinIO, Wasabi,
// Backblaze B2 (S3 API), DigitalOcean Spaces, Ceph RGW, and Google Cloud
// Storage through its S3 interoperability endpoint. The only S3 SDK import in
// the codebase (ADR-001, enforced by lint in P0-11).

export type S3StorageOptions = {
  readonly bucket: string;
  readonly region: string;
  /** Omit for AWS; set for every other S3-compatible provider. */
  readonly endpoint?: string | undefined;
  /** true for MinIO and most self-hosted stores. */
  readonly forcePathStyle: boolean;
  /** Omit to use the default AWS credential chain (IAM role, env, profile). */
  readonly credentials?:
    { readonly accessKeyId: string; readonly secretAccessKey: string } | undefined;
};

const statusOf = (err: unknown): number | undefined =>
  (err as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;

const isNotFound = (err: unknown): boolean => {
  const name = (err as { name?: string } | null)?.name;
  return name === "NoSuchKey" || name === "NotFound" || statusOf(err) === 404;
};

const encodeKeyForCopySource = (bucket: string, key: string): string =>
  `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

export class S3StorageAdapter implements StorageAdapter {
  readonly provider = "s3" as const;
  readonly capabilities = { nativePresign: true } as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.credentials ? { credentials: options.credentials } : {}),
      // Checksums on every request would reject S3-compatible stores that do
      // not implement the newer CRC headers; send them only when required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  private wrap(err: unknown, action: string, key: string): never {
    if (isNotFound(err)) throw new StorageNotFoundError(key, { cause: err });
    throw new StorageUnavailableError(`s3 ${action} failed for ${key}`, { cause: err });
  }

  async put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo> {
    validateObjectKey(key);
    const counter = new ByteCounter();
    const stream = toReadable(body).pipe(counter);
    try {
      // lib-storage's Upload handles streams of unknown length with a
      // multipart upload, and small bodies with a single PUT.
      await new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream,
          ContentType: options.contentType,
          ...(options.cacheControl ? { CacheControl: options.cacheControl } : {}),
        },
      }).done();
    } catch (err) {
      this.wrap(err, "put", key);
    }
    const info = await this.stat(key);
    return (
      info ?? {
        key,
        byteSize: counter.bytes,
        contentType: options.contentType,
        lastModified: new Date(),
      }
    );
  }

  async get(key: string): Promise<GetResult> {
    validateObjectKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        body: res.Body as Readable,
        info: {
          key,
          byteSize: res.ContentLength ?? 0,
          contentType: res.ContentType ?? "application/octet-stream",
          lastModified: res.LastModified ?? new Date(0),
        },
      };
    } catch (err) {
      this.wrap(err, "get", key);
    }
  }

  async stat(key: string): Promise<ObjectInfo | null> {
    validateObjectKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        key,
        byteSize: res.ContentLength ?? 0,
        contentType: res.ContentType ?? "application/octet-stream",
        lastModified: res.LastModified ?? new Date(0),
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw new StorageUnavailableError(`s3 stat failed for ${key}`, { cause: err });
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    validateObjectKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      if (!isNotFound(err)) this.wrap(err, "delete", key);
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo> {
    validateObjectKey(sourceKey);
    validateObjectKey(destinationKey);
    try {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: destinationKey,
          CopySource: encodeKeyForCopySource(this.bucket, sourceKey),
        }),
      );
    } catch (err) {
      this.wrap(err, "copy", sourceKey);
    }
    const info = await this.stat(destinationKey);
    if (!info) throw new StorageUnavailableError(`s3 copy produced no object at ${destinationKey}`);
    return info;
  }

  async list(prefix: string, options: ListOptions = {}): Promise<ListResult> {
    validatePrefix(prefix);
    try {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: clampListLimit(options.limit),
          ...(options.cursor ? { ContinuationToken: options.cursor } : {}),
        }),
      );
      return {
        objects: (res.Contents ?? []).map((o) => ({
          key: o.Key ?? "",
          byteSize: o.Size ?? 0,
          // ListObjectsV2 does not return content types; stat() when needed.
          contentType: "application/octet-stream",
          lastModified: o.LastModified ?? new Date(0),
        })),
        nextCursor: res.IsTruncated && res.NextContinuationToken ? res.NextContinuationToken : null,
      };
    } catch (err) {
      throw new StorageUnavailableError(`s3 list failed for prefix ${prefix}`, { cause: err });
    }
  }

  async presignPut(key: string, options: PresignPutOptions): Promise<PresignedUrl> {
    validateObjectKey(key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: options.contentType }),
      { expiresIn: options.expiresInSeconds, signableHeaders: new Set(["content-type"]) },
    );
    return {
      url,
      method: "PUT",
      headers: { "content-type": options.contentType },
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000),
      kind: "native",
    };
  }

  async presignGet(key: string, options: PresignGetOptions): Promise<PresignedUrl> {
    validateObjectKey(key);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn: options.expiresInSeconds,
      },
    );
    return {
      url,
      method: "GET",
      headers: {},
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000),
      kind: "native",
    };
  }

  async close(): Promise<void> {
    this.client.destroy();
  }
}
