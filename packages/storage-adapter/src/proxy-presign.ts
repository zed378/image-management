import { createHmac, timingSafeEqual } from "node:crypto";

import { StorageTokenError } from "./errors";
import { validateObjectKey } from "./keys";
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
} from "./types";

// Presigned URLs for providers that cannot issue their own (ADR-021): local
// disk, NFS, SFTP, WebDAV. The platform signs a token binding the exact key,
// the method, the expiry, and -- for uploads -- the content type and maximum
// size; its own HTTP endpoint verifies the token and streams to or from the
// adapter. Direct upload (P2-03) therefore works identically on every
// provider, and clients cannot tell which kind of URL they received.

export type ProxyTokenPayload = {
  /** Object key. */
  readonly k: string;
  /** Method. */
  readonly m: "PUT" | "GET";
  /** Expiry, unix seconds. */
  readonly e: number;
  /** Required content type (PUT). */
  readonly ct?: string;
  /** Maximum body size in bytes (PUT). */
  readonly max?: number;
};

export type ProxyPresignOptions = {
  /** Public base URL of the api, e.g. https://api.example.com. */
  readonly baseUrl: string;
  /** HMAC key, >= 32 bytes of entropy. From STORAGE_PROXY_SIGNING_SECRET. */
  readonly secret: string;
  readonly now?: () => Date;
};

/** Path the api serves the proxy on; the token is its last segment. */
export const PROXY_PATH = "/v1/storage/proxy";

const sign = (encodedPayload: string, secret: string): string =>
  createHmac("sha256", secret).update(encodedPayload).digest("base64url");

export const createProxyToken = (payload: ProxyTokenPayload, secret: string): string => {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
};

/**
 * Verify a proxy token for a specific method. Signature comparison is
 * constant-time; the expiry is checked *after* the signature so that an
 * attacker learns nothing about a forged token's payload from the error.
 */
export const verifyProxyToken = (
  token: string,
  method: "PUT" | "GET",
  secret: string,
  now: Date = new Date(),
): ProxyTokenPayload => {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) throw new StorageTokenError("malformed token");

  const expected = Buffer.from(sign(encoded, secret), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new StorageTokenError("invalid token signature");
  }

  let payload: ProxyTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ProxyTokenPayload;
  } catch {
    throw new StorageTokenError("malformed token payload");
  }
  if (payload.m !== method) throw new StorageTokenError("token is for a different method");
  if (typeof payload.e !== "number" || payload.e * 1000 <= now.getTime()) {
    throw new StorageTokenError("token expired");
  }
  validateObjectKey(payload.k);
  return payload;
};

/**
 * Wrap any adapter so presignPut/presignGet always work: native URLs where
 * the provider supports them, platform-proxied URLs otherwise. Every other
 * operation is delegated unchanged.
 */
export const withProxyPresign = (adapter: StorageAdapter, options: ProxyPresignOptions): StorageAdapter => {
  if (Buffer.byteLength(options.secret, "utf8") < 32) {
    throw new Error("proxy presign secret must be at least 32 bytes");
  }
  const now = options.now ?? (() => new Date());
  const base = options.baseUrl.replace(/\/+$/, "");

  const proxyUrl = (payload: ProxyTokenPayload): string =>
    `${base}${PROXY_PATH}/${createProxyToken(payload, options.secret)}`;

  return {
    provider: adapter.provider,
    capabilities: adapter.capabilities,
    put: (key: string, body: ObjectBody, putOptions: PutOptions): Promise<ObjectInfo> =>
      adapter.put(key, body, putOptions),
    get: (key: string): Promise<GetResult> => adapter.get(key),
    stat: (key: string): Promise<ObjectInfo | null> => adapter.stat(key),
    exists: (key: string): Promise<boolean> => adapter.exists(key),
    delete: (key: string): Promise<void> => adapter.delete(key),
    copy: (sourceKey: string, destinationKey: string): Promise<ObjectInfo> => adapter.copy(sourceKey, destinationKey),
    list: (prefix: string, listOptions?: ListOptions): Promise<ListResult> => adapter.list(prefix, listOptions),
    close: (): Promise<void> => adapter.close(),

    presignPut: async (key: string, o: PresignPutOptions): Promise<PresignedUrl> => {
      if (adapter.capabilities.nativePresign) return adapter.presignPut(key, o);
      validateObjectKey(key);
      const expiresAt = new Date(now().getTime() + o.expiresInSeconds * 1000);
      const payload: ProxyTokenPayload = {
        k: key,
        m: "PUT",
        e: Math.floor(expiresAt.getTime() / 1000),
        ct: o.contentType,
        ...(o.maxBytes !== undefined ? { max: o.maxBytes } : {}),
      };
      return {
        url: proxyUrl(payload),
        method: "PUT",
        headers: { "content-type": o.contentType },
        expiresAt,
        kind: "proxy",
      };
    },

    presignGet: async (key: string, o: PresignGetOptions): Promise<PresignedUrl> => {
      if (adapter.capabilities.nativePresign) return adapter.presignGet(key, o);
      validateObjectKey(key);
      const expiresAt = new Date(now().getTime() + o.expiresInSeconds * 1000);
      return {
        url: proxyUrl({ k: key, m: "GET", e: Math.floor(expiresAt.getTime() / 1000) }),
        method: "GET",
        headers: {},
        expiresAt,
        kind: "proxy",
      };
    },
  };
};
