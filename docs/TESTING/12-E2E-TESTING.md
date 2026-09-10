# 12 - End-to-End Testing

> Category: **Testing** (`docs/TESTING/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify end-to-end testing for the Image Management & Delivery Platform. Full-stack tests against a real (or realistic local) deployment: upload an asset, request a derivative, assert on the actual bytes/dimensions returned, covering the platform's core promise end to end.

## Category Mandate

The test strategy across every layer of the platform -- unit, integration, API contract, transformation correctness, security, performance, failure-injection, and end-to-end -- with explicit ownership of what each layer is responsible for catching.

## Key Topics To Specify

- Full-stack tests against a real (or realistic local) deployment: upload an asset, request a derivative, assert on the actual bytes/dimensions returned, covering the platform's core promise end to end.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/TESTING/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
