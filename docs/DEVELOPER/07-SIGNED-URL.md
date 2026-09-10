# 07 - Signed URLs

> Category: **Developer Documentation** (`docs/DEVELOPER/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify signed urls for the Image Management & Delivery Platform. Define the signed URL scheme: HMAC-SHA256 over the canonical request (path + params + expiry) with a per-application secret, expiry as a Unix timestamp, and the exact string-to-sign so client SDKs can reproduce it.

## Category Mandate

Documentation is treated as a product surface, not an afterthought: getting-started material, task-oriented guides, and reference material written for a developer integrating the platform into a consumer application for the first time.

## Key Topics To Specify

- Define the signed URL scheme: HMAC-SHA256 over the canonical request (path + params + expiry) with a per-application secret, expiry as a Unix timestamp, and the exact string-to-sign so client SDKs can reproduce it.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/DEVELOPER/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
