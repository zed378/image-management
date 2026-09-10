# 08 - SLOs & SLIs

> Category: **Observability** (`docs/OBSERVABILITY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify slos & slis for the Image Management & Delivery Platform. Define target values (e.g. 99.9% of image delivery requests < 200ms at the edge, 99.5% API availability) each backed by a specific SLI query, and the error budget policy when a target is missed.

## Category Mandate

Logging, metrics, and tracing across every service boundary, plus the SLIs/SLOs and alerting rules that turn raw telemetry into an operable signal for on-call engineers.

## Key Topics To Specify

- Define target values (e.g. 99.9% of image delivery requests < 200ms at the edge, 99.5% API availability) each backed by a specific SLI query, and the error budget policy when a target is missed.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/OBSERVABILITY/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
