# 03 - Bucket Strategy

> Category: **Storage** (`docs/STORAGE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How many buckets (or roots, containers, shares) the platform uses, and how
tenants are separated within them.

## Category Mandate

Storage is abstracted behind an internal interface so the object storage
provider can be swapped without any consumer-facing change. These documents
define that abstraction, bucket and object-naming strategy, lifecycle,
replication, backup, and cost control.

---

## Decision: one bucket per environment

Each deployment environment (production, staging, a developer's machine) has
exactly one storage location, named by its configuration: a local directory
(`STORAGE_LOCAL_ROOT`, the default -- ADR-021), an S3 bucket, an Azure
container, an SFTP or WebDAV root. Tenants are separated **by key prefix**
inside it (`{tenant_id}/{project_id}/...`, `04-OBJECT-NAMING.md`), and the
platform is the only principal with credentials to it.

Why not a bucket per tenant:

- Bucket counts are limited per account (S3: a default quota in the
  hundreds), and creating one is an account-level operation the platform
  should not need at signup.
- Isolation does not come from the bucket: callers never hold storage
  credentials. Every access goes through the platform (or a presigned URL
  it issues for one key), which derives keys only from rows it has already
  scoped to the caller's tenant.
- One lifecycle, replication and backup configuration covers everything.

A dedicated bucket for one tenant (a contractual data-residency requirement)
remains possible later as a per-tenant storage override; it would be a new
ADR, not a change to this default.

## Controls that make a shared bucket safe

| Control | Where |
|---|---|
| Keys built only from platform-generated ids | `object-keys.ts` refuses anything else |
| Every key starts with the tenant id | same; tested |
| No public bucket access, no listing for callers | provider configuration (`docs/DEVOPS/`); callers get presigned URLs for single keys only (`SEC-URL-05`) |
| Presigned URLs bound to one key, one method, a short expiry | `packages/storage-adapter` proxy tokens / provider presign |
| Per-tenant purge is a prefix delete | `18-DATA-RETENTION.md` |

## Acceptance Criteria

- [x] The strategy and its reasons are stated; each isolation control names
      where it is enforced.

## Related Documents

- `docs/STORAGE/04-OBJECT-NAMING.md`, `00-STORAGE-ARCHITECTURE.md`
- `docs/SECURITY/10-MULTI-TENANT-SECURITY.md`
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-021`)
