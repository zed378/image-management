# 01 - Architecture Principles

> Category: **Architecture** (`docs/ARCHITECTURE/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify architecture principles for the Image Management & Delivery Platform. State the non-negotiable architectural rules once so every other document can assume them: storage-agnostic, stateless API tier, derivatives are pure functions of (asset, params), tenant isolation enforced at the data layer not just the API layer.

## Category Mandate

Describes the system as a set of independently deployable services with explicit boundaries: API Gateway, Asset Service, Image Processing Service, Storage Service, CDN, Cache, Queue, Search. The platform is designed storage-agnostic and delivery-agnostic: consumer applications talk to a stable API contract, never to a storage backend or a processing engine directly.

## Key Topics To Specify

- State the non-negotiable architectural rules once so every other document can assume them: storage-agnostic, stateless API tier, derivatives are pure functions of (asset, params), tenant isolation enforced at the data layer not just the API layer.

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
