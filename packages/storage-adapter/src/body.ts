import { Readable, Transform, type TransformCallback } from "node:stream";

import type { ObjectBody } from "./types";

export const toReadable = (body: ObjectBody): Readable =>
  body instanceof Readable
    ? body
    : Readable.from(Buffer.from(body.buffer, body.byteOffset, body.byteLength));

export const toBuffer = async (body: ObjectBody): Promise<Buffer> => {
  if (!(body instanceof Readable))
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  const chunks: Buffer[] = [];
  for await (const chunk of body)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
};

/** Pass-through that counts bytes, so a streamed upload knows its size. */
export class ByteCounter extends Transform {
  bytes = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.bytes += chunk.length;
    callback(null, chunk);
  }
}

export const clampListLimit = (limit: number | undefined): number =>
  Math.min(Math.max(limit ?? 1000, 1), 1000);

/**
 * Paginate an in-memory, sorted key list with an opaque cursor. Used by the
 * backends that have no native listing cursor (filesystems, SFTP, WebDAV):
 * the cursor is the last key returned, base64url-encoded so callers do not
 * mistake it for something they can construct.
 */
export const paginateSorted = <T extends { key: string }>(
  sorted: readonly T[],
  cursor: string | undefined,
  limit: number,
): { page: T[]; nextCursor: string | null } => {
  const after = cursor ? Buffer.from(cursor, "base64url").toString("utf8") : null;
  const start = after === null ? 0 : sorted.findIndex((o) => o.key > after);
  const from = start === -1 ? sorted.length : start;
  const page = sorted.slice(from, from + limit);
  const more = from + limit < sorted.length;
  const last = page.at(-1);
  return {
    page,
    nextCursor: more && last ? Buffer.from(last.key, "utf8").toString("base64url") : null,
  };
};
