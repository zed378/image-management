import { AppError } from "@image-delivery/errors";
import { UPLOAD_MAX_BYTES } from "@image-delivery/image-engine";
import { PROXY_PATH, verifyProxyToken } from "@image-delivery/storage-adapter";

import type { StorageAdapter } from "@image-delivery/storage-adapter";
import type { FastifyInstance } from "fastify";

// The platform-proxied presigned URL endpoint (P2-03,
// docs/STORAGE/01-STORAGE-ABSTRACTION.md "Presigned URLs on every provider").
//
// Providers that cannot sign their own URLs (local disk, SFTP, WebDAV) get
// every upload and download URL from here instead. The token binds the exact
// object key, the method, the expiry, and -- for PUT -- the content type and
// maximum size, so a URL a client holds cannot be re-pointed at another object,
// re-used for another method, raised in size, or replayed after its expiry.
//
// This route is deliberately *outside* the authenticated /v1 scope: a browser
// or a CDN edge presenting a presigned URL holds no API key. Authorization is
// the HMAC signature; that is the entire trust model (ADR-021).

export type StorageProxyOptions = {
  readonly storage: StorageAdapter;
  /** HMAC key; at least 32 bytes. */
  readonly secret: string;
};

export const registerStorageProxy = (app: FastifyInstance, options: StorageProxyOptions): void => {
  const { storage, secret } = options;

  // PUT: the client uploads the original straight through to the adapter.
  app.put(`${PROXY_PATH}/:token`, async (request, reply) => {
    const { token } = request.params as { token: string };
    const payload = verifyProxyToken(token, "PUT", secret);

    // The token's size ceiling is enforced while the body streams, so an
    // oversized upload is cut off rather than buffered and then refused.
    const declaredLength = Number(request.headers["content-length"] ?? Number.NaN);
    if (
      Number.isFinite(declaredLength) &&
      payload.max !== undefined &&
      declaredLength > payload.max
    ) {
      throw new AppError("upload_too_large");
    }
    if (payload.max !== undefined && payload.max > UPLOAD_MAX_BYTES) {
      // Never let a token raise the platform's own ceiling.
      throw new AppError("upload_too_large");
    }
    if (payload.ct !== undefined) {
      const sent = request.headers["content-type"]?.split(";")[0]?.trim();
      if (sent !== payload.ct) {
        throw new AppError("unsupported_media_type", {
          message: "The upload must be sent with the Content-Type it was issued for.",
        });
      }
    }

    const body = await readBoundedBody(request, payload.max ?? UPLOAD_MAX_BYTES);
    try {
      await storage.put(payload.k, body, {
        contentType: payload.ct ?? "application/octet-stream",
      });
    } catch (err) {
      request.log.error({ err, key_present: true }, "proxy upload to storage failed");
      throw new AppError("storage_unavailable", { cause: err });
    }

    // 200, not 201: the object key already existed conceptually the moment the
    // asset row was created; this completes the write the client was promised.
    return reply.status(200).send();
  });

  // GET: the client downloads through the platform on providers that cannot
  // sign a read URL. Delivery/signed-URL semantics arrive in Phase 4.
  app.get(`${PROXY_PATH}/:token`, async (request, reply) => {
    const { token } = request.params as { token: string };
    const payload = verifyProxyToken(token, "GET", secret);

    let object;
    try {
      object = await storage.get(payload.k);
    } catch (err) {
      request.log.warn({ err, key_present: true }, "proxy read from storage failed");
      throw new AppError("asset_not_found", { cause: err });
    }

    return reply
      .status(200)
      .header("content-type", object.info.contentType)
      .header("content-length", String(object.info.byteSize))
      .send(object.body);
  });
};

/**
 * Buffer the request body, refusing it as soon as it passes `max`. The proxy
 * is the one place the api accepts an upload-sized body, so Fastify's 1 MiB
 * JSON limit does not apply here; the ceiling is the token's own.
 */
const readBoundedBody = async (request: FastifyRequestLike, max: number): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request.raw) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > max) throw new AppError("upload_too_large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

/** The structural minimum this file needs from a Fastify request. */
type FastifyRequestLike = {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly raw: AsyncIterable<Buffer | string>;
};
