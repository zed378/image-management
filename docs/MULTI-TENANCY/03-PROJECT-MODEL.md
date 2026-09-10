# 03 - Project Model

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify project model for the Image Management & Delivery Platform. Define the entity, its primary key strategy (ULID recommended for sortability), required columns, foreign keys, and the indexes needed for the query patterns this platform actually runs.

## Category Mandate

The platform is consumed by many independent applications (tenants), each with its own assets, quotas, and CDN configuration. Multi-tenancy is treated as a fundamental, load-bearing requirement, not an afterthought: a request scoped to Tenant A must never be able to read, modify, or enumerate Tenant B's resources under any circumstance.

## Key Topics To Specify

- Define the entity, its primary key strategy (ULID recommended for sortability), required columns, foreign keys, and the indexes needed for the query patterns this platform actually runs.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/MULTI-TENANCY/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
