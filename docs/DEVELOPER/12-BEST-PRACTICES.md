# 12 - Best Practices

> Category: **Developer Documentation** (`docs/DEVELOPER/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify best practices for the Image Management & Delivery Platform. Curate the handful of decisions that most affect a consumer application's cost and performance: use format=auto, set explicit width/height (never rely on defaults), use the client-side <Image/> component instead of hand-built URLs, prefer signed URLs over making assets fully public when in doubt.

## Category Mandate

Documentation is treated as a product surface, not an afterthought: getting-started material, task-oriented guides, and reference material written for a developer integrating the platform into a consumer application for the first time.

## Key Topics To Specify

- Curate the handful of decisions that most affect a consumer application's cost and performance: use format=auto, set explicit width/height (never rely on defaults), use the client-side <Image/> component instead of hand-built URLs, prefer signed URLs over making assets fully public when in doubt.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/DEVELOPER/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
