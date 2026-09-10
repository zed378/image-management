# 05 - Upload UX

> Category: **Dashboard UI/UX** (`docs/UI-UX/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify upload ux for the Image Management & Delivery Platform. Define every supported ingestion path: direct multipart upload, upload from a remote URL, and a signed direct-to-storage upload for large files -- and the validation each path runs before the asset is marked ready.

## Category Mandate

The optional developer/admin dashboard is not the platform's primary consumer -- the API is -- but it is the primary way a human operator manages assets, keys, and usage. These documents define its information architecture and key screens.

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

- `docs/UI-UX/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
