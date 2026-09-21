# 01 - Storage Abstraction

> Category: **Storage** (`docs/STORAGE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The `StorageAdapter` interface, verbatim, and the rules every implementation
obeys. Consumer applications never learn which storage sits underneath
(`ADR-001`); this interface is how that stays true.

## Category Mandate

Storage is abstracted behind an internal interface so the storage provider
can be swapped without any consumer-facing change.

---

## The interface

From `packages/storage-adapter/src/types.ts`, kept in sync with the code:

```ts
export type StorageProviderName = "local" | "s3" | "azure-blob" | "sftp" | "webdav" | "memory";

export type ObjectBody = Readable | Buffer | Uint8Array;

export type PutOptions = {
  readonly contentType: string;
  readonly cacheControl?: string;
};

export type ObjectInfo = {
  readonly key: string;
  readonly byteSize: number;
  readonly contentType: string;
  readonly lastModified: Date;
};

export type GetResult = { readonly body: Readable; readonly info: ObjectInfo };

export type ListOptions = { readonly cursor?: string | undefined; readonly limit?: number };
export type ListResult = { readonly objects: readonly ObjectInfo[]; readonly nextCursor: string | null };

export type PresignPutOptions = { readonly expiresInSeconds: number; readonly contentType: string; readonly maxBytes?: number };
export type PresignGetOptions = { readonly expiresInSeconds: number };
export type PresignedUrl = {
  readonly url: string;
  readonly method: "PUT" | "GET";
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
  readonly kind: "native" | "proxy";
};

export type StorageCapabilities = { readonly nativePresign: boolean };

export interface StorageAdapter {
  readonly provider: StorageProviderName;
  readonly capabilities: StorageCapabilities;
  put(key: string, body: ObjectBody, options: PutOptions): Promise<ObjectInfo>;
  get(key: string): Promise<GetResult>;
  stat(key: string): Promise<ObjectInfo | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  copy(sourceKey: string, destinationKey: string): Promise<ObjectInfo>;
  list(prefix: string, options?: ListOptions): Promise<ListResult>;
  presignPut(key: string, options: PresignPutOptions): Promise<PresignedUrl>;
  presignGet(key: string, options: PresignGetOptions): Promise<PresignedUrl>;
  close(): Promise<void>;
}
```

`ADR-001` named `put`, `get`, `delete`, `exists`, `presignPut`,
`presignGet`, `list`. The implementation adds `stat` (metadata without the
body), `copy` (needed by duplication, `P2-07`), `close` (connection-holding
providers), and the `capabilities` declaration.

## Semantics every implementation guarantees

| Operation | Guarantee |
|---|---|
| `put` | **Atomic**: a concurrent reader sees the previous object or the new one, never a partial write. Overwrites. Accepts a stream of unknown length. |
| `get` | Throws `StorageNotFoundError` when absent. |
| `stat` / `exists` | `null` / `false` when absent; never throw for absence. |
| `delete` | Idempotent: deleting an absent object succeeds. |
| `copy` | The destination is independent: deleting the source leaves it intact. |
| `list` | Only keys starting with the prefix; sorted ascending; paginated by an **opaque** cursor that callers must never construct or parse. |
| `presignPut` / `presignGet` | Native URLs where `capabilities.nativePresign`; otherwise `StorageCapabilityError`. Wrap with `withProxyPresign()` to get a URL from every provider. |

## Keys

One grammar, validated in one place (`src/keys.ts`) before any backend is
touched -- on filesystem-like providers a key becomes a path, so this is also
the path-traversal defence:

```
key      = segment *( "/" segment )            ; 1-1024 characters
segment  = [A-Za-z0-9_=-] *[A-Za-z0-9._=-]      ; never starts with "."
```

Rejected: empty, leading, trailing, or doubled slashes; `.` and `..`; any
segment starting with `.`; backslashes; colons (NTFS streams); spaces,
control characters, non-ASCII; Windows device names (`CON`, `NUL`, `COM1`,
...). The object-naming scheme (`04-OBJECT-NAMING.md`) produces only keys
inside this grammar.

## Errors

Provider-specific failures are translated at the adapter boundary:

| Class | Meaning |
|---|---|
| `StorageNotFoundError` | The object does not exist |
| `StorageKeyError` | The key is invalid; nothing was attempted |
| `StorageCapabilityError` | The provider cannot do this (e.g. native presign) |
| `StorageUnavailableError` | The backend failed or is unreachable; retryable |
| `StorageTokenError` | A proxy token is malformed, tampered, expired, or for another method |

A `NoSuchKey`, `ENOENT`, `RestError`, or WebDAV `404` reaching a caller is a
bug in the adapter.

## Presigned URLs on every provider

Object stores (S3-compatible, Azure) sign their own URLs. The others cannot,
so `withProxyPresign(adapter, { baseUrl, secret })` issues
**platform-proxied** URLs:

```
https://<api>/v1/storage/proxy/<base64url(payload)>.<base64url(HMAC-SHA256(secret, payload))>

payload = { k: key, m: "PUT"|"GET", e: expiry (unix s), ct?: content type, max?: bytes }
```

`verifyProxyToken(token, method, secret)` checks the signature with a
constant-time comparison **before** reading the payload, then the method, the
expiry, and the key grammar. The token binds the key, so it cannot be
re-pointed at another object; it binds the size limit, so it cannot be
raised. The api serves `PROXY_PATH` and streams to or from the adapter
(`P2-03`). A client cannot tell a proxy URL from a native one.

## Verification

`packages/storage-adapter/tests/conformance.ts` is the definition of "a
supported provider". Every adapter runs it **unmodified** against a real
server: 23 cases covering round-trip, streaming, overwrite, atomicity under a
concurrent reader, not-found, stat, idempotent delete, independent copy,
paginated listing, eleven hostile key shapes, and presigned upload/download
including expiry. Results at `P0-07`: local 23/23, memory 23/23, S3 (MinIO)
23/23, Azure Blob (Azurite) 23/23, SFTP (OpenSSH) 23/23, WebDAV 23/23.

## Acceptance Criteria

- [x] The interface is reproduced verbatim from the code.
- [x] Every semantic guarantee is covered by a conformance case.
- [x] Presigned URLs work for every provider, natively or through the proxy.

## Open Questions

- Range reads (`Range:` delivery, `docs/IMAGE-DELIVERY-PROTOCOL/28`) are not
  in the interface yet; `P4-07` decides whether to add them.

## Related Documents

- `packages/storage-adapter/`
- `docs/STORAGE/00-STORAGE-ARCHITECTURE.md`, `04-OBJECT-NAMING.md`, `10-STORAGE-PROVIDER-ADAPTER.md`
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-021`)
