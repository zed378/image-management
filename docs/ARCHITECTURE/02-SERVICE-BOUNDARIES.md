# 02 - Service Boundaries

> Category: **Architecture** (`docs/ARCHITECTURE/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify service boundaries for the Image Management & Delivery Platform. Draw the service boundary as a contract, not a folder: each service owns its data, is deployed independently, and is only reachable through its published API -- no service reaches into another's database.

## Category Mandate

Describes the system as a set of independently deployable services with explicit boundaries: API Gateway, Asset Service, Image Processing Service, Storage Service, CDN, Cache, Queue, Search. The platform is designed storage-agnostic and delivery-agnostic: consumer applications talk to a stable API contract, never to a storage backend or a processing engine directly.

## Key Topics To Specify

- Draw the service boundary as a contract, not a folder: each service owns its data, is deployed independently, and is only reachable through its published API -- no service reaches into another's database.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/ARCHITECTURE/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
