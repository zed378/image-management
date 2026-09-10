# 06 - Business Rules

> Category: **Product & Plan** (`docs/PLAN/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify business rules for the Image Management & Delivery Platform. Capture rules that are not obvious from the data model alone: e.g. an asset cannot be hard-deleted while referenced by an active collection; a project cannot exceed its plan's storage quota; a signed URL cannot outlive its parent API key.

## Category Mandate

Defines what the platform is, who it is for, and what it must do before any code is written. Everything under PLAN/ is product intent: requirements, scope, business rules, and the roadmap. Architecture and API documents implement what PLAN/ decides; they must not silently redefine it.

## Key Topics To Specify

- Capture rules that are not obvious from the data model alone: e.g. an asset cannot be hard-deleted while referenced by an active collection; a project cannot exceed its plan's storage quota; a signed URL cannot outlive its parent API key.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/PLAN/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
