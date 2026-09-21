import { randomBytes } from "node:crypto";
import path from "node:path/posix";

import { createClient, type FileStat, type WebDAVClient } from "webdav";

import { clampListLimit, paginateSorted, toBuffer } from "../body";
import { StorageCapabilityError, StorageNotFoundError, StorageUnavailableError } from "../errors";
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
import type { Readable } from "node:stream";

// WebDAV (RFC 4918): Nextcloud, ownCloud, Apache mod_dav, nginx dav, most NAS
// appliances. Same object layout as the filesystem adapters. Writes go to a
// temp resource and are MOVEd into place, because many WebDAV servers write
// a PUT body directly into the target, which a concurrent reader could see
// half-written.

export type WebDavStorageOptions = {
  /** Server URL, e.g. https://dav.example.com/remote.php/dav/files/user */
  readonly url: string;
  readonly username?: string | undefined;
  readonly password?: string | undefined;
  /** Directory under the server URL that plays the role of the bucket. */
  readonly root: string;
};

const META_DIR = ".meta";

const statusOf = (err: unknown): number | undefined => (err as { status?: number } | null)?.status;

type Sidecar = { readonly contentType: string };

export class WebDavStorageAdapter implements StorageAdapter {
  readonly provider = "webdav" as const;
  readonly capabilities = { nativePresign: false } as const;
  private readonly client: WebDAVClient;
  private readonly root: string;

  constructor(options: WebDavStorageOptions) {
    this.client = createClient(options.url, {
      ...(options.username ? { username: options.username } : {}),
      ...(options.password ? { password: options.password } : {}),
    });
    this.root = `/${options.root.replace(/^\/+|\/+$/g, "")}`;
  }

  private remote(key: string): string {
    return path.join(this.root, ...validateObjectKey(key).split("/"));
  }

  private remoteMeta(key: string): string {
    return path.join(this.root, META_DIR, ...validateObjectKey(key).split("/")) + ".json";
  }

  private async atomicUpload(target: string, data: Buffer): Promise<void> {
    const dir = path.dirname(target);
    await this.client.createDirectory(dir, { recursive: true });
    const temp = path.join(dir, `.tmp-${randomBytes(8).toString("hex")}`);
    try {
      await this.client.putFileContents(temp, data, {
        overwrite: true,
        contentLength: data.length,
      });
      await this.client.moveFile(temp, target, { overwrite: true });
    } catch (err) {
      await this.client.deleteFile(temp).catch(() => undefined);
      throw err;
    }
  }

  async put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo> {
    const target = this.remote(key);
    // Buffered: a known Content-Length is the most widely supported way to
    // PUT to WebDAV servers, several of which reject chunked request bodies.
    const bytes = await toBuffer(body);
    try {
      await this.atomicUpload(
        this.remoteMeta(key),
        Buffer.from(JSON.stringify({ contentType: options.contentType })),
      );
      await this.atomicUpload(target, bytes);
    } catch (err) {
      throw new StorageUnavailableError(`webdav put failed for ${key}`, { cause: err });
    }
    const info = await this.stat(key);
    if (!info) throw new StorageUnavailableError(`webdav put produced no resource at ${key}`);
    return info;
  }

  async get(key: string): Promise<GetResult> {
    const info = await this.stat(key);
    if (!info) throw new StorageNotFoundError(key);
    try {
      return { body: this.client.createReadStream(this.remote(key)) as Readable, info };
    } catch (err) {
      throw new StorageUnavailableError(`webdav get failed for ${key}`, { cause: err });
    }
  }

  async stat(key: string): Promise<ObjectInfo | null> {
    // Resolve (and validate) outside the try, so a StorageKeyError is never
    // re-labelled as a backend failure.
    const target = this.remote(key);
    const meta = this.remoteMeta(key);
    let s: FileStat;
    try {
      s = (await this.client.stat(target)) as FileStat;
    } catch (err) {
      if (statusOf(err) === 404) return null;
      throw new StorageUnavailableError(`webdav stat failed for ${key}`, { cause: err });
    }
    if (s.type !== "file") return null;
    let sidecar: Sidecar | null = null;
    try {
      sidecar = JSON.parse(
        (await this.client.getFileContents(meta, { format: "text" })) as string,
      ) as Sidecar;
    } catch (err) {
      if (statusOf(err) !== 404)
        throw new StorageUnavailableError(`webdav meta read failed for ${key}`, { cause: err });
    }
    return {
      key,
      byteSize: s.size,
      contentType: sidecar?.contentType ?? "application/octet-stream",
      lastModified: new Date(s.lastmod),
    };
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    for (const target of [this.remote(key), this.remoteMeta(key)]) {
      try {
        await this.client.deleteFile(target);
      } catch (err) {
        if (statusOf(err) !== 404)
          throw new StorageUnavailableError(`webdav delete failed for ${key}`, { cause: err });
      }
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo> {
    const source = await this.get(sourceKey);
    return this.put(destinationKey, await toBuffer(source.body), {
      contentType: source.info.contentType,
    });
  }

  async list(prefix: string, options: ListOptions = {}): Promise<ListResult> {
    validatePrefix(prefix);
    const dirPart = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/")) : "";
    const keys: string[] = [];
    // Depth-1 recursion rather than `Depth: infinity`, which many servers
    // refuse or cap for load reasons.
    const walk = async (dir: string, keyPrefix: string): Promise<void> => {
      let entries: FileStat[];
      try {
        entries = await this.client.getDirectoryContents(dir);
      } catch (err) {
        if (statusOf(err) === 404) return;
        throw new StorageUnavailableError("webdav list failed", { cause: err });
      }
      for (const entry of entries) {
        if (entry.basename.startsWith(".")) continue;
        const key = keyPrefix ? `${keyPrefix}/${entry.basename}` : entry.basename;
        if (entry.type === "directory") await walk(path.join(dir, entry.basename), key);
        else keys.push(key);
      }
    };
    await walk(dirPart ? path.join(this.root, ...dirPart.split("/")) : this.root, dirPart);
    const infos: ObjectInfo[] = [];
    for (const key of keys.filter((k) => k.startsWith(prefix)).sort()) {
      const info = await this.stat(key);
      if (info) infos.push(info);
    }
    const { page, nextCursor } = paginateSorted(
      infos,
      options.cursor,
      clampListLimit(options.limit),
    );
    return { objects: page, nextCursor };
  }

  presignPut(): Promise<PresignedUrl> {
    return Promise.reject(
      new StorageCapabilityError("webdav has no native presign; use withProxyPresign"),
    );
  }

  presignGet(): Promise<PresignedUrl> {
    return Promise.reject(
      new StorageCapabilityError("webdav has no native presign; use withProxyPresign"),
    );
  }

  async close(): Promise<void> {}
}
