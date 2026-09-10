# 00 - CDN Architecture

> Category: **CDN & Cache** (`docs/CDN/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify cdn architecture for the Image Management & Delivery Platform. Define how derivatives reach the edge: origin shield, cache key composition, TTL policy, and purge/invalidation API.

## Category Mandate

Every distinct combination of transformation parameters is a distinct derivative and therefore a distinct cache entry. These documents define the cache key strategy, TTLs, invalidation, edge delivery topology, and failover so that the platform can serve derivatives at CDN speed without regenerating them per request.

## Key Topics To Specify

- Define how derivatives reach the edge: origin shield, cache key composition, TTL policy, and purge/invalidation API.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/CDN/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
