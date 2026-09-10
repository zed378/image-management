# 08 - Cross-Tenant Protection

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify cross-tenant protection for the Image Management & Delivery Platform. Enumerate the specific attack this document defends against: an authenticated caller for Tenant A supplying Tenant B's resource ID and expecting the platform to refuse it, every time, at every layer.

## Category Mandate

The platform is consumed by many independent applications (tenants), each with its own assets, quotas, and CDN configuration. Multi-tenancy is treated as a fundamental, load-bearing requirement, not an afterthought: a request scoped to Tenant A must never be able to read, modify, or enumerate Tenant B's resources under any circumstance.

## Key Topics To Specify

- Enumerate the specific attack this document defends against: an authenticated caller for Tenant A supplying Tenant B's resource ID and expecting the platform to refuse it, every time, at every layer.
- The top-level isolation boundary: owns Applications, is the scope for billing/plan, and is the row every other table's tenant_id foreign key must trace back to.
- Defense in depth: authorization check at the API layer AND a tenant_id filter at the query layer, so a bug in one layer alone cannot cause a cross-tenant leak.

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
