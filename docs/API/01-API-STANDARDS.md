# 01 - API Standards

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify api standards for the Image Management & Delivery Platform. Fix the API's conventions once: JSON:API-like envelope or plain JSON, snake_case vs. camelCase, timestamp format (RFC 3339 UTC), how nulls vs. absent fields are distinguished.

## Category Mandate

The platform is API-first. Every capability exposed to a consumer application is defined here as a versioned, documented HTTP contract before it is implemented. These documents are the source of truth for request/response shapes, status codes, and error formats -- SDKs and the dashboard are clients of this contract, not the other way around.

## Key Topics To Specify

- Fix the API's conventions once: JSON:API-like envelope or plain JSON, snake_case vs. camelCase, timestamp format (RFC 3339 UTC), how nulls vs. absent fields are distinguished.

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
