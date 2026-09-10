# 03 - Distributed Tracing

> Category: **Observability** (`docs/OBSERVABILITY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify distributed tracing for the Image Management & Delivery Platform. Propagate a trace ID from the API Gateway through the Asset Service, Image Processing Service, and Storage Service so a single slow request can be followed across service boundaries.

## Category Mandate

Logging, metrics, and tracing across every service boundary, plus the SLIs/SLOs and alerting rules that turn raw telemetry into an operable signal for on-call engineers.

## Key Topics To Specify

- Propagate a trace ID from the API Gateway through the Asset Service, Image Processing Service, and Storage Service so a single slow request can be followed across service boundaries.

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
