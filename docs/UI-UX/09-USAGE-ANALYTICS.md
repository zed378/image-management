# 09 - Usage Analytics

> Category: **Dashboard UI/UX** (`docs/UI-UX/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify usage analytics for the Image Management & Delivery Platform. Time-bucketed counters (storage bytes, bandwidth bytes, transformation count, request count) per tenant/application/project, written by an async aggregator, never computed synchronously on the request path.

## Category Mandate

The optional developer/admin dashboard is not the platform's primary consumer -- the API is -- but it is the primary way a human operator manages assets, keys, and usage. These documents define its information architecture and key screens.

## Key Topics To Specify

- Time-bucketed counters (storage bytes, bandwidth bytes, transformation count, request count) per tenant/application/project, written by an async aggregator, never computed synchronously on the request path.
- Usage over time, broken down by metric and by project, with the ability to export/download for the tenant's own reporting.

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
