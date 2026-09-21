# 10 - Storage Provider Adapters

> Category: **Storage** (`docs/STORAGE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Every supported storage provider, how to configure it, what it is suited
for, and its limits. "Supported" has one meaning: the provider's adapter
passes the conformance suite in `01-STORAGE-ABSTRACTION.md`, unmodified,
against a real server.

## Category Mandate

Storage is abstracted behind an internal interface so the provider can be
swapped without any consumer-facing change.

---

## Summary

| `STORAGE_PROVIDER` | Covers | Native presign | Verified against | Suited for |
|---|---|---|---|---|
| **`local`** (default) | local disk; **NFS, SMB/CIFS, AWS EFS, Azure Files, CephFS, GlusterFS** mounted as a directory | no -- proxied | local filesystem | single host; multi-host with a shared mount |
| `s3` | AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2, DigitalOcean Spaces, Ceph RGW, GCS (S3 interoperability) | yes | MinIO | cloud and large deployments |
| `azure-blob` | Azure Blob Storage | yes (SAS) | Azurite | Azure deployments |
| `sftp` | any SSH server | no -- proxied | OpenSSH (`atmoz/sftp`) | archival, low volume, existing file servers |
| `webdav` | Nextcloud, ownCloud, Apache/nginx DAV, NAS appliances | no -- proxied | `hacdias/webdav` | existing DAV infrastructure |

`ADR-021` made `local` the default and records why each provider exists.

## `local` -- disk and network filesystems

```bash
STORAGE_PROVIDER=local                      # the default
STORAGE_LOCAL_ROOT=/var/lib/image-delivery  # required in production
```

Development defaults the root to `.data/storage`. In production the process
refuses to start without `STORAGE_LOCAL_ROOT`: a container writing to its own
ephemeral filesystem loses every original on restart.

**Network filesystems use this provider.** Mount the share and point
`STORAGE_LOCAL_ROOT` at the mount point. Requirements for correctness:

- **Multi-host deployments need one shared mount.** `api` and `worker` both
  read and write; on separate machines they must see the same directory, or
  an original uploaded through one host is invisible to a worker on another.
- **Same-directory rename must be atomic.** It is on NFSv3/v4, SMB2+, EFS and
  Azure Files. The adapter relies on it for atomic writes.
- **NFS:** mount with the default hard mount (not `soft`), so a server hiccup
  blocks rather than silently fails a write; close-to-open consistency (the
  default) is sufficient, because every write is fsync'd before the rename
  that makes it visible.
- **SMB/CIFS:** the adapter works with the default `cache=strict`.

How it stores objects: the file at `<root>/<key>`, a sidecar
`<root>/.meta/<key>.json` holding the content type, and short-lived
`.tmp-*` files during writes. Keys can never start a segment with `.`, so
none of these can collide with an object. Listing walks directories from
the deepest directory the prefix names; very large flat directories list
slowly, which the object-naming scheme avoids by partitioning keys by tenant,
project, and asset.

On Windows (developer machines), replacing a file another handle has open
fails with `EPERM`; the adapter retries the rename for up to three seconds.

## `s3` -- S3-compatible object storage

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=images-production
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com  # omit for AWS
STORAGE_S3_FORCE_PATH_STYLE=false                              # true for MinIO
STORAGE_S3_ACCESS_KEY_ID=...                                   # omit both for an IAM role
STORAGE_S3_SECRET_ACCESS_KEY=...
```

Streams of unknown length are uploaded as multipart uploads. Request
checksums are sent only when required, so stores that do not implement the
newer CRC headers still work. Presigned PUTs cannot enforce a size limit
(that needs presigned POST), so `P2-03` checks the object's size after
completion and rejects it when it exceeds the limit.

**GCS** is supported through its S3 interoperability endpoint
(`STORAGE_S3_ENDPOINT=https://storage.googleapis.com` with HMAC keys). This
path uses the same adapter but is **not** exercised against real GCS in CI.

## `azure-blob`

```bash
STORAGE_PROVIDER=azure-blob
STORAGE_AZURE_ACCOUNT_NAME=imagesprod
STORAGE_AZURE_ACCOUNT_KEY=...
STORAGE_AZURE_CONTAINER=images
STORAGE_AZURE_ENDPOINT=...   # omit for the public cloud
```

Block-blob commits are atomic. Presigned URLs are Shared Access Signatures,
which require the account key; a PUT must send `x-ms-blob-type: BlockBlob`
(returned in `PresignedUrl.headers`). Listing uses Azure's own continuation
token as the cursor.

## `sftp`

```bash
STORAGE_PROVIDER=sftp
STORAGE_SFTP_HOST=files.example.com
STORAGE_SFTP_PORT=22
STORAGE_SFTP_USERNAME=images
STORAGE_SFTP_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END..."   # or STORAGE_SFTP_PASSWORD
STORAGE_SFTP_ROOT=/srv/images
STORAGE_SFTP_HOST_KEY_SHA256=<base64 fingerprint>   # required in production
```

**Host key verification is mandatory in production.** Without a pinned
fingerprint an SSH connection can be intercepted; `ssh-keygen -lf` on the
server's host key prints the value (drop the `SHA256:` prefix). A literal
`\n` in the private key is converted to a newline, for single-line env files.

Writes use a temp file and the `posix-rename@openssh.com` extension to replace
the target atomically. Operations are **serialized on one SSH connection**,
which caps throughput: suitable for archival or low-volume projects, not a
busy delivery origin.

## `webdav`

```bash
STORAGE_PROVIDER=webdav
STORAGE_WEBDAV_URL=https://dav.example.com/remote.php/dav/files/images
STORAGE_WEBDAV_USERNAME=images
STORAGE_WEBDAV_PASSWORD=...
STORAGE_WEBDAV_ROOT=/image-delivery
```

Writes go to a temp resource and are `MOVE`d over the target, because many
DAV servers write a `PUT` body straight into the target where a concurrent
reader could see it half-written. Bodies are buffered to send a known
`Content-Length`, which the widest range of servers accept. Listing recurses
with `Depth: 1` rather than `Depth: infinity`, which many servers refuse.

## Presigned URLs for the proxied providers

`local`, `sftp`, and `webdav` get upload and download URLs from
`withProxyPresign()` (`01-STORAGE-ABSTRACTION.md`), signed with
`STORAGE_PROXY_SIGNING_SECRET` (added with the endpoint in `P2-03`). Traffic
through those URLs passes through the api rather than going straight to
storage, so bandwidth for direct uploads is the api's, not the storage
provider's -- the trade for supporting providers that cannot sign.

## Adding a provider

1. Implement `StorageAdapter` in `packages/storage-adapter/src/adapters/`.
2. Add a `tests/<provider>.int.test.ts` that starts a real server (or its
   official emulator) and calls `describeStorageConformance`.
3. Pass the suite **unmodified**. If a case cannot pass, the contract changes
   for every adapter; the suite is not weakened for one provider.
4. Add the provider to `STORAGE_PROVIDERS`, its variables and rules to
   `packages/config`, and a section here.

## Acceptance Criteria

- [x] Every provider is listed with configuration, suitability, and limits.
- [x] Every provider passes the conformance suite against a real server
      (local, MinIO, Azurite, OpenSSH, WebDAV), recorded in `P0-07`.
- [x] The network-filesystem requirements are stated, including the
      multi-host shared-mount rule.

## Open Questions

- Azure with managed identity would use user-delegation SAS instead of the
  account key; not implemented in v1.
- A native GCS adapter (instead of S3 interoperability) is not needed unless
  a deployment requires GCS features the S3 API lacks.
- SFTP connection pooling would lift its throughput cap if an SFTP-backed
  deployment ever needs it.

## Related Documents

- `docs/STORAGE/00-STORAGE-ARCHITECTURE.md`, `01-STORAGE-ABSTRACTION.md`, `04-OBJECT-NAMING.md`
- `docs/DEVOPS/03-CONFIGURATION.md` (every variable)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-021`)
