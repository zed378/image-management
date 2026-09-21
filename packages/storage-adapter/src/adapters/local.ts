import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat as fsStat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { ByteCounter, clampListLimit, paginateSorted, toReadable } from "../body";
import {
  StorageCapabilityError,
  StorageKeyError,
  StorageNotFoundError,
  StorageUnavailableError,
} from "../errors";
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

// The default provider (ADR-021): a directory on a filesystem. The same code
// serves a local disk and any network filesystem mounted as a directory --
// NFS, SMB/CIFS, AWS EFS, Azure Files, CephFS, GlusterFS -- because all of
// them present POSIX-like files.
//
// Guarantees, and how they survive a network filesystem:
//
// * Atomic writes. Bytes go to a temp file in the *same directory*, are
//   fsync'd, then renamed over the target. rename() within one directory is
//   atomic on local filesystems and on NFS, so a reader sees the old object
//   or the new one, never a partial file. fsync before rename matters on NFS
//   in particular: it forces the data to the server before the name that
//   makes it visible to other clients exists.
// * Metadata. Filesystems have no content-type, so each object has a sidecar
//   JSON file under `.meta/`. Keys cannot start a segment with ".", so the
//   sidecar tree and temp files can never collide with a real key.
// * Containment. Every path is derived from a validated key and re-checked to
//   resolve inside the root, so no key can reach outside it.

const META_DIR = ".meta";

type Sidecar = { readonly contentType: string };

const isErrno = (err: unknown, code: string): boolean =>
  typeof err === "object" && err !== null && (err as { code?: unknown }).code === code;

/**
 * rename() replaces the target atomically on Linux, macOS and NFS. Windows
 * refuses (EPERM/EBUSY/EACCES) to replace a file another handle has open --
 * a concurrent reader -- so retry briefly there. Readers are short-lived; a
 * bounded retry is the standard remedy (graceful-fs does the same).
 */
const RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);

const renameWithRetry = async (from: string, to: string): Promise<void> => {
  const deadline = Date.now() + 3_000;
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (!RENAME_RETRY_CODES.has(code) || Date.now() > deadline) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10 * 2 ** attempt, 200)));
    }
  }
};

export type LocalStorageOptions = {
  /** Absolute or relative directory. Created on first write. */
  readonly root: string;
};

export class LocalFileSystemAdapter implements StorageAdapter {
  readonly provider = "local" as const;
  readonly capabilities = { nativePresign: false } as const;
  private readonly root: string;

  constructor(options: LocalStorageOptions) {
    this.root = path.resolve(options.root);
  }

  private objectPath(key: string): string {
    return this.contained(path.join(this.root, ...validateObjectKey(key).split("/")));
  }

  private metaPath(key: string): string {
    return (
      this.contained(path.join(this.root, META_DIR, ...validateObjectKey(key).split("/"))) + ".json"
    );
  }

  /**
   * Defence in depth behind key validation: never touch a path outside root.
   * The check is lexical (path.resolve), so it cannot be defeated by a key --
   * validateObjectKey already refuses `..` -- but it does not follow symlinks.
   * A symlink inside the root is operator-placed (a mount, a migration aid)
   * and is trusted; no API writes one.
   */
  private contained(candidate: string): string {
    const resolved = path.resolve(candidate);
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new StorageKeyError("object key resolves outside the storage root");
    }
    return resolved;
  }

  private async atomicWrite(
    target: string,
    source: NodeJS.ReadableStream | Buffer,
  ): Promise<number> {
    await mkdir(path.dirname(target), { recursive: true });
    const temp = path.join(path.dirname(target), `.tmp-${randomBytes(8).toString("hex")}`);
    let bytes: number;
    try {
      if (Buffer.isBuffer(source)) {
        // `flush: true` fsyncs before close (Node >= 21).
        await writeFile(temp, source, { flag: "wx", flush: true });
        bytes = source.length;
      } else {
        const counter = new ByteCounter();
        await pipeline(source, counter, createWriteStream(temp, { flags: "wx", flush: true }));
        bytes = counter.bytes;
      }
      await renameWithRetry(temp, target);
    } catch (err) {
      await unlink(temp).catch(() => undefined);
      throw err;
    }
    return bytes;
  }

  private async readSidecar(key: string): Promise<Sidecar | null> {
    try {
      return JSON.parse(await readFile(this.metaPath(key), "utf8")) as Sidecar;
    } catch (err) {
      if (isErrno(err, "ENOENT")) return null;
      throw err;
    }
  }

  async put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo> {
    const target = this.objectPath(key);
    try {
      // Sidecar first, object second: the object's rename is the commit point.
      const sidecar: Sidecar = { contentType: options.contentType };
      await this.atomicWrite(this.metaPath(key), Buffer.from(JSON.stringify(sidecar)));
      const byteSize = await this.atomicWrite(
        target,
        Buffer.isBuffer(body) ? body : toReadable(body),
      );
      const s = await fsStat(target);
      return { key, byteSize, contentType: options.contentType, lastModified: s.mtime };
    } catch (err) {
      if (err instanceof StorageKeyError) throw err;
      throw new StorageUnavailableError(`local put failed for ${key}`, { cause: err });
    }
  }

  async get(key: string): Promise<GetResult> {
    const info = await this.stat(key);
    if (!info) throw new StorageNotFoundError(key);
    return { body: createReadStream(this.objectPath(key)), info };
  }

  async stat(key: string): Promise<ObjectInfo | null> {
    const target = this.objectPath(key);
    let s;
    try {
      s = await fsStat(target);
    } catch (err) {
      if (isErrno(err, "ENOENT") || isErrno(err, "ENOTDIR")) return null;
      throw new StorageUnavailableError(`local stat failed for ${key}`, { cause: err });
    }
    if (!s.isFile()) return null;
    const sidecar = await this.readSidecar(key);
    return {
      key,
      byteSize: s.size,
      contentType: sidecar?.contentType ?? "application/octet-stream",
      lastModified: s.mtime,
    };
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    const target = this.objectPath(key);
    const meta = this.metaPath(key);
    await rm(target, { force: true });
    await rm(meta, { force: true });
  }

  async copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo> {
    const source = await this.get(sourceKey);
    return this.put(destinationKey, source.body, { contentType: source.info.contentType });
  }

  async list(prefix: string, options: ListOptions = {}): Promise<ListResult> {
    validatePrefix(prefix);
    // Start the walk at the deepest directory the prefix fully names, rather
    // than at the root, so listing one asset's derivatives does not scan the
    // whole store.
    const dirPart = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/")) : "";
    const start = dirPart ? this.contained(path.join(this.root, ...dirPart.split("/"))) : this.root;
    const keys: string[] = [];
    await this.walk(start, dirPart, keys);
    const matching = keys.filter((k) => k.startsWith(prefix)).sort();
    const infos: ObjectInfo[] = [];
    for (const key of matching) {
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

  private async walk(dir: string, keyPrefix: string, into: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (isErrno(err, "ENOENT") || isErrno(err, "ENOTDIR")) return;
      throw new StorageUnavailableError("local list failed", { cause: err });
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // .meta, temp files
      const key = keyPrefix ? `${keyPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await this.walk(path.join(dir, entry.name), key, into);
      else if (entry.isFile()) into.push(key);
    }
  }

  presignPut(): Promise<PresignedUrl> {
    return Promise.reject(
      new StorageCapabilityError("local storage has no native presign; use withProxyPresign"),
    );
  }

  presignGet(): Promise<PresignedUrl> {
    return Promise.reject(
      new StorageCapabilityError("local storage has no native presign; use withProxyPresign"),
    );
  }

  async close(): Promise<void> {}
}
