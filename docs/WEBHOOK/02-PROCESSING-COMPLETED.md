# 02 - processing.completed Event

> Category: **Webhooks** (`docs/WEBHOOK/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify processing.completed event for the Image Management & Delivery Platform. Fired once eager derivative generation (if configured) finishes successfully -- payload includes the derivatives generated and their URLs.

## Category Mandate

Asynchronous notifications for events a consumer application cannot efficiently poll for -- upload completion, processing completion or failure, deletion, and updates -- delivered with signed payloads and a defined retry policy.

## Key Topics To Specify

- Fired once eager derivative generation (if configured) finishes successfully -- payload includes the derivatives generated and their URLs.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/WEBHOOK/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
