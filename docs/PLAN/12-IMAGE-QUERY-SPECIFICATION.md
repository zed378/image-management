# 12 - Image Query Specification

> Category: **Product & Plan** (`docs/PLAN/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify image query specification for the Image Management & Delivery Platform. Define the declarative query surface consumers use to request a derivative: a REST query-string form (?w=&h=&fit=&...) and, if offered, a path-segment form. The two must be provably equivalent.

## Category Mandate

Defines what the platform is, who it is for, and what it must do before any code is written. Everything under PLAN/ is product intent: requirements, scope, business rules, and the roadmap. Architecture and API documents implement what PLAN/ decides; they must not silently redefine it.

## Key Topics To Specify

- Define the declarative query surface consumers use to request a derivative: a REST query-string form (?w=&h=&fit=&...) and, if offered, a path-segment form. The two must be provably equivalent.

## Reference Example

```
Original:      4000 x 3000

Consumer requests:
  width=800
  height=600
  position=top

Result:
  800 x 600, crop gravity = top

--- or, smart-crop variant ---

  width=400
  height=400
  position=face
  fit=cover
```
This is the difference between a plain resize service and a *query* interface:
the consumer describes the *outcome* it wants (a face-centered square thumbnail)
and the platform decides how to get there. `docs/IMAGE-PROCESSING/07-FOCAL-POINT.md`
and `08-AUTO-CROP.md` define how `position=face` (or any smart position) resolves.

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
