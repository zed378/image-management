# 01 - JavaScript SDK

> Category: **SDKs & Client Libraries** (`docs/SDK/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify javascript sdk for the Image Management & Delivery Platform. A zero-dependency (or minimal-dependency) client for browser and Node, covering authentication, asset CRUD, and building transformation URLs.

## Category Mandate

Thin, typed clients over the public API contract, plus a client-side image component pattern so consumer applications can request transformed images declaratively instead of hand-building query strings.

## Key Topics To Specify

- A zero-dependency (or minimal-dependency) client for browser and Node, covering authentication, asset CRUD, and building transformation URLs.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/SDK/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
