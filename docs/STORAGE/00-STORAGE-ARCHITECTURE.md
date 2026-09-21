# 00 - Storage Architecture

> Category: **Storage** (`docs/STORAGE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Where image bytes live and how the rest of the platform reaches them.

## Category Mandate

Storage is abstracted behind an internal interface so the storage provider
can be swapped without any consumer-facing change. These documents define
that abstraction, bucket and object-naming strategy, lifecycle, replication,
backup, and cost control.

---

## The shape

```
        services/api                      services/worker
   (upload, delivery, proxy)          (derivatives, sweepers)
              \                             /
               \                           /
         packages/storage-adapter  (the only code that knows the provider)
               |      |       |       |       |
             local    s3    azure    sftp   webdav
          (disk, NFS,  (S3, R2,  (Blob)
           SMB, EFS)   MinIO..)
```

- **One interface** (`01-STORAGE-ABSTRACTION.md`), **five providers**
  (`10-STORAGE-PROVIDER-ADAPTER.md`), chosen by `STORAGE_PROVIDER`
  (`docs/DEVOPS/03-CONFIGURATION.md`). **Local disk is the default**
  (`ADR-021`).
- Storage is an **in-process library**, not a network service (`ADR-017`).
- **Nothing outside `packages/storage-adapter` imports a provider SDK**
  (`ADR-001`), enforced by lint (`P0-11`).
- **The database holds references, storage holds bytes.** Every original and
  derivative has a row pointing at its object key; the object is never the
  source of truth for metadata.

## What is stored

| Object | Key scheme (`04-OBJECT-NAMING.md`) | Written by | Lifetime |
|---|---|---|---|
| Original | `{tenant}/{project}/originals/{asset}/{version}.{ext}` | api (upload) | until hard delete after retention |
| Derivative | `{tenant}/{project}/derivatives/{asset}/{version}/{params_hash}.{ext}` | api (cheap sync) or worker | regenerable; evictable |

Tenant and project lead every key. On object stores that makes per-tenant
IAM prefixes and lifecycle rules possible; on filesystems it keeps any one
directory small.

## Durability boundary

Originals are the only irreplaceable bytes -- derivatives can always be
regenerated from them. Backup and restore (`07`, `08`) therefore cover
originals and the database; derivatives are not backed up.

## Acceptance Criteria

- [x] The provider-independence rule, the default, and the durability
      boundary are stated with the ADRs behind them.

## Related Documents

- `docs/STORAGE/01-STORAGE-ABSTRACTION.md`, `04-OBJECT-NAMING.md`, `10-STORAGE-PROVIDER-ADAPTER.md`
- `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md`
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-017`, `ADR-021`)
