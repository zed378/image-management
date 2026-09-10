# 08 - Auto Crop

> Category: **Image Processing** (`docs/IMAGE-PROCESSING/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify auto crop for the Image Management & Delivery Platform. Define the auto-crop/smart-crop strategy (e.g. saliency or face detection) as best-effort with a documented fallback to center-crop when detection fails or confidence is low -- never a hard dependency for basic resize/crop to work.

## Category Mandate

Specifies the deterministic pipeline that turns an original asset plus a set of requested parameters (width, height, fit, position, quality, format, DPR) into a derivative image. Determinism matters: the same asset + the same parameter set must always produce a byte-identical (or acceptably equivalent, for lossy re-encodes) result, because that identity is the cache key.

## Key Topics To Specify

- Define the auto-crop/smart-crop strategy (e.g. saliency or face detection) as best-effort with a documented fallback to center-crop when detection fails or confidence is low -- never a hard dependency for basic resize/crop to work.
- Define crop as width+height+fit=cover (or crop=) combined with a position/gravity/focal-point parameter that decides which region of the source is kept.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/IMAGE-PROCESSING/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
