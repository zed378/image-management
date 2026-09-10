# 11 - Upload API

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify upload api for the Image Management & Delivery Platform. Define every supported ingestion path: direct multipart upload, upload from a remote URL, and a signed direct-to-storage upload for large files -- and the validation each path runs before the asset is marked ready.

## Category Mandate

The platform is API-first. Every capability exposed to a consumer application is defined here as a versioned, documented HTTP contract before it is implemented. These documents are the source of truth for request/response shapes, status codes, and error formats -- SDKs and the dashboard are clients of this contract, not the other way around.

## Key Topics To Specify

- Define every supported ingestion path: direct multipart upload, upload from a remote URL, and a signed direct-to-storage upload for large files -- and the validation each path runs before the asset is marked ready.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/API/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
