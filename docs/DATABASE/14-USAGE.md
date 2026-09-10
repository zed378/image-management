# 14 - Usage

> Category: **Database & Data Model** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify usage for the Image Management & Delivery Platform. Time-bucketed counters (storage bytes, bandwidth bytes, transformation count, request count) per tenant/application/project, written by an async aggregator, never computed synchronously on the request path.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage, and audit. Each document specifies one table or table family: its columns, constraints, indexes, and the invariants the application layer must enforce on top of the schema.

## Key Topics To Specify

- Time-bucketed counters (storage bytes, bandwidth bytes, transformation count, request count) per tenant/application/project, written by an async aggregator, never computed synchronously on the request path.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/DATABASE/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
