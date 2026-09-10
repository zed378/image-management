# 10 - Storage Provider Adapter

> Category: **Storage** (`docs/STORAGE/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify storage provider adapter for the Image Management & Delivery Platform. List supported providers (S3, Cloudflare R2, GCS, Azure Blob, MinIO for local/dev) and the subset of the StorageAdapter interface each must implement to be considered supported.

## Category Mandate

Storage is abstracted behind an internal interface so the object storage provider (S3, R2, GCS, MinIO, Azure Blob) can be swapped without any consumer-facing change. These documents define that abstraction, bucket and object-naming strategy, lifecycle, replication, backup, and cost control.

## Key Topics To Specify

- List supported providers (S3, Cloudflare R2, GCS, Azure Blob, MinIO for local/dev) and the subset of the StorageAdapter interface each must implement to be considered supported.

## Reference Example

```
Image API
   |
   v
Storage Interface
   |
   +-- S3
   +-- MinIO
   +-- Cloudflare R2
   +-- Azure Blob
   +-- GCS
```
No code outside this adapter layer may import a provider SDK directly. A new
provider is supported by implementing the interface in `01-STORAGE-ABSTRACTION.md`,
nothing else changes -- this is the acceptance test for "storage-agnostic".

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/STORAGE/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
