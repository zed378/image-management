# 10 - Format Conversion

> Category: **Image Processing** (`docs/IMAGE-PROCESSING/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify format conversion for the Image Management & Delivery Platform. Define supported output formats (jpeg, png, webp, avif, gif) and the format=auto negotiation: prefer AVIF, then WebP, then JPEG, based on the request's Accept header, with an explicit override always taking precedence.

## Category Mandate

Specifies the deterministic pipeline that turns an original asset plus a set of requested parameters (width, height, fit, position, quality, format, DPR) into a derivative image. Determinism matters: the same asset + the same parameter set must always produce a byte-identical (or acceptably equivalent, for lossy re-encodes) result, because that identity is the cache key.

## Key Topics To Specify

- Define supported output formats (jpeg, png, webp, avif, gif) and the format=auto negotiation: prefer AVIF, then WebP, then JPEG, based on the request's Accept header, with an explicit override always taking precedence.
- Format conversion must preserve transparency where the target format supports it and flatten to a background color where it does not (e.g. PNG-with-alpha to JPEG).

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
