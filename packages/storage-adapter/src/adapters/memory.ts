import { Readable } from "node:stream";

import { clampListLimit, paginateSorted, toBuffer } from "../body";
import { StorageCapabilityError, StorageNotFoundError } from "../errors";
import { validateObjectKey, validatePrefix } from "../keys";
import type {
  GetResult,
  ListOptions,
  ListResult,
  ObjectBody,
  ObjectInfo,
  PresignedUrl,
  PutOptions,
  StorageAdapter,
} from "../types";

type Entry = { readonly bytes: Buffer; readonly info: ObjectInfo };

/** In-process adapter for unit tests. Not for production: nothing persists. */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly provider = "memory" as const;
  readonly capabilities = { nativePresign: false } as const;
  private readonly objects = new Map<string, Entry>();

  async put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo> {
    validateObjectKey(key);
    const bytes = await toBuffer(body);
    const info: ObjectInfo = { key, byteSize: bytes.length, contentType: options.contentType, lastModified: new Date() };
    this.objects.set(key, { bytes, info });
    return info;
  }

  async get(key: string): Promise<GetResult> {
    validateObjectKey(key);
    const entry = this.objects.get(key);
    if (!entry) throw new StorageNotFoundError(key);
    return { body: Readable.from(Buffer.from(entry.bytes)), info: entry.info };
  }

  async stat(key: string): Promise<ObjectInfo | null> {
    validateObjectKey(key);
    return this.objects.get(key)?.info ?? null;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    validateObjectKey(key);
    this.objects.delete(key);
  }

  async copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo> {
    const source = await this.get(sourceKey);
    return this.put(destinationKey, source.body, { contentType: source.info.contentType });
  }

  async list(prefix: string, options: ListOptions = {}): Promise<ListResult> {
    validatePrefix(prefix);
    const sorted = [...this.objects.values()]
      .map((e) => e.info)
      .filter((i) => i.key.startsWith(prefix))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const { page, nextCursor } = paginateSorted(sorted, options.cursor, clampListLimit(options.limit));
    return { objects: page, nextCursor };
  }

  presignPut(): Promise<PresignedUrl> {
    return Promise.reject(new StorageCapabilityError("memory adapter has no native presign"));
  }

  presignGet(): Promise<PresignedUrl> {
    return Promise.reject(new StorageCapabilityError("memory adapter has no native presign"));
  }

  async close(): Promise<void> {}
}
