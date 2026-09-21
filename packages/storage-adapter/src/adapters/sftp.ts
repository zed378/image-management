// createHash here fingerprints the server host key, not transformation params.
// eslint-disable-next-line no-restricted-imports -- see above (ADR-004 is about params hashing)
import { createHash, randomBytes } from "node:crypto";
import path from "node:path/posix";
import { PassThrough, type Readable } from "node:stream";

import SftpClient from "ssh2-sftp-client";

import { ByteCounter, clampListLimit, paginateSorted, toBuffer, toReadable } from "../body";
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

// SFTP: file storage on any SSH server, reachable over a network or the
// internet. Same object layout and guarantees as the local adapter -- temp
// file plus rename for atomic writes, `.meta/` sidecars for content types --
// over one SSH connection.
//
// Operations are serialized on the connection: ssh2-sftp-client does not
// support concurrent operations on one client. That caps throughput, which is
// why docs/STORAGE/10 positions SFTP for archival and low-volume deployments
// rather than a busy delivery origin.

export type SftpStorageOptions = {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string | undefined;
  readonly privateKey?: string | undefined;
  /** Remote directory that plays the role of the bucket. */
  readonly root: string;
  /**
   * SHA-256 of the server's host key, base64 (as `ssh-keygen -lf` prints it,
   * without the "SHA256:" prefix). When set, any other host key is refused --
   * the defence against a man-in-the-middle. Required in production by config.
   */
  readonly hostKeySha256?: string | undefined;
};

const META_DIR = ".meta";
const NO_SUCH_FILE = 2;

type Sidecar = { readonly contentType: string };

const isNoSuchFile = (err: unknown): boolean => {
  const e = err as { code?: unknown; message?: unknown } | null;
  return (
    e?.code === NO_SUCH_FILE ||
    e?.code === "ENOENT" ||
    (typeof e?.message === "string" && /no such file/i.test(e.message))
  );
};

export class SftpStorageAdapter implements StorageAdapter {
  readonly provider = "sftp" as const;
  readonly capabilities = { nativePresign: false } as const;
  private readonly options: SftpStorageOptions;
  private client: SftpClient | null = null;
  private connecting: Promise<SftpClient> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: SftpStorageOptions) {
    this.options = { ...options, root: options.root.replace(/\/+$/, "") || "/" };
  }

  private remote(key: string): string {
    return path.join(this.options.root, ...validateObjectKey(key).split("/"));
  }

  private remoteMeta(key: string): string {
    return path.join(this.options.root, META_DIR, ...validateObjectKey(key).split("/")) + ".json";
  }

  private async connection(): Promise<SftpClient> {
    if (this.client) return this.client;
    this.connecting ??= (async () => {
      const client = new SftpClient();
      const expected = this.options.hostKeySha256?.replace(/^SHA256:/, "");
      await client.connect({
        host: this.options.host,
        port: this.options.port,
        username: this.options.username,
        ...(this.options.password ? { password: this.options.password } : {}),
        ...(this.options.privateKey ? { privateKey: this.options.privateKey } : {}),
        readyTimeout: 10_000,
        ...(expected
          ? {
              hostVerifier: (key: Buffer): boolean =>
                createHash("sha256").update(key).digest("base64").replace(/=+$/, "") ===
                expected.replace(/=+$/, ""),
            }
          : {}),
      });
      client.on("close", () => {
        this.client = null;
        this.connecting = null;
      });
      this.client = client;
      return client;
    })().catch((err: unknown) => {
      this.connecting = null;
      throw new StorageUnavailableError("sftp connection failed", { cause: err });
    });
    return this.connecting;
  }

  /** Run one operation at a time on the shared connection. */
  private serial<T>(fn: (client: SftpClient) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => fn(await this.connection()));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async atomicUpload(
    client: SftpClient,
    target: string,
    data: Readable | Buffer,
  ): Promise<void> {
    const dir = path.dirname(target);
    await client.mkdir(dir, true);
    const temp = path.join(dir, `.tmp-${randomBytes(8).toString("hex")}`);
    try {
      await client.put(data, temp);
      // posix-rename@openssh.com replaces an existing target atomically;
      // plain SFTP rename fails when the target exists.
      await client.posixRename(temp, target);
    } catch (err) {
      await client.delete(temp, true).catch(() => undefined);
      throw err;
    }
  }

  async put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo> {
    const target = this.remote(key);
    const meta = this.remoteMeta(key);
    const counter = new ByteCounter();
    const data = Buffer.isBuffer(body) ? body : toReadable(body).pipe(counter);
    try {
      await this.serial(async (client) => {
        await this.atomicUpload(
          client,
          meta,
          Buffer.from(JSON.stringify({ contentType: options.contentType })),
        );
        await this.atomicUpload(client, target, data);
      });
    } catch (err) {
      throw err instanceof StorageUnavailableError
        ? err
        : new StorageUnavailableError(`sftp put failed for ${key}`, { cause: err });
    }
    const info = await this.stat(key);
    if (!info) throw new StorageUnavailableError(`sftp put produced no file at ${key}`);
    return info;
  }

  async get(key: string): Promise<GetResult> {
    const info = await this.stat(key);
    if (!info) throw new StorageNotFoundError(key);
    const target = this.remote(key);
    // Buffer the file rather than hold the serialized connection open for the
    // lifetime of a caller-controlled stream, which would stall every other
    // operation until the caller finished reading.
    const bytes = await this.serial(async (client) => (await client.get(target)) as Buffer);
    const body = new PassThrough();
    body.end(bytes);
    return { body, info };
  }

  async stat(key: string): Promise<ObjectInfo | null> {
    const target = this.remote(key);
    const meta = this.remoteMeta(key);
    try {
      return await this.serial(async (client) => {
        let s;
        try {
          s = await client.stat(target);
        } catch (err) {
          if (isNoSuchFile(err)) return null;
          throw err;
        }
        if (!s.isFile) return null;
        let sidecar: Sidecar | null = null;
        try {
          sidecar = JSON.parse(((await client.get(meta)) as Buffer).toString("utf8")) as Sidecar;
        } catch (err) {
          if (!isNoSuchFile(err)) throw err;
        }
        return {
          key,
          byteSize: s.size,
          contentType: sidecar?.contentType ?? "application/octet-stream",
          lastModified: new Date(s.modifyTime),
        };
      });
    } catch (err) {
      throw err instanceof StorageUnavailableError
        ? err
        : new StorageUnavailableError(`sftp stat failed for ${key}`, { cause: err });
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    const target = this.remote(key);
    const meta = this.remoteMeta(key);
    await this.serial(async (client) => {
      await client.delete(target, true);
      await client.delete(meta, true);
    });
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
    await this.serial(async (client) => {
      const walk = async (dir: string, keyPrefix: string): Promise<void> => {
        let entries;
        try {
          entries = await client.list(dir);
        } catch (err) {
          if (isNoSuchFile(err)) return;
          throw err;
        }
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          const key = keyPrefix ? `${keyPrefix}/${entry.name}` : entry.name;
          if (entry.type === "d") await walk(path.join(dir, entry.name), key);
          else if (entry.type === "-") keys.push(key);
        }
      };
      await walk(
        dirPart ? path.join(this.options.root, ...dirPart.split("/")) : this.options.root,
        dirPart,
      );
    });
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
      new StorageCapabilityError("sftp has no native presign; use withProxyPresign"),
    );
  }

  presignGet(): Promise<PresignedUrl> {
    return Promise.reject(
      new StorageCapabilityError("sftp has no native presign; use withProxyPresign"),
    );
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    if (client) await client.end().catch(() => undefined);
  }
}
