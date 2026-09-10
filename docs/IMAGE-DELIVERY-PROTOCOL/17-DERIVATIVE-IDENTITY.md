# 17 - Derivative Identity

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define what a "derivative" is as a first-class concept: its identity, its relationship to the original, and its own lifecycle.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- `derivative_id = hash(asset_version + canonical_transformation_parameters)` -- deterministic, so requesting the same transformation twice always resolves to the same derivative identity, never creates a duplicate.
- State explicitly whether derivatives are generated on-demand (lazily, on first request) vs. pre-generated (eagerly, for a configured preset set) -- default: on-demand, with `docs/IMAGE-PROCESSING/15-THUMBNAIL-GENERATION.md`'s eager presets as the only exception.
- State that a derivative is immutable once created for a given `asset_version`; a new asset version invalidates *all* derivatives of the prior version (never partially), per `19-CACHE-CONTROL.md`.
- Clarify a derivative is a cache/storage optimization, not a first-class user-facing resource -- it has no independent API identity a consumer ever references directly; consumers only ever reference `asset_id` plus parameters.

## Reference Example

```
asset A (version 4)
 +-- derivative: 800x600-cover-webp-q80
 +-- derivative: 400x400-cover-webp-q80
 +-- derivative: 1200x800-cover-avif-q80
 +-- derivative: 1920x1080-jpeg-q80
```
Every one of the above is fully reconstructible from `(asset A, version 4,
canonical parameters)` -- none of them needs to be individually backed up
(see `docs/STORAGE/07-STORAGE-BACKUP.md`), only regenerable on cache miss.

## Acceptance Criteria

- [ ] Every parameter/rule this document defines has exactly one authoritative source -- if `docs/API/13-IMAGE-TRANSFORMATION-API.md` or another document also describes it, one defers to the other explicitly, they never silently disagree.
- [ ] Every rule is testable by an automated conformance test (see `37-PROTOCOL-TESTING.md`) or explicitly marked operational-only.
- [ ] Cross-references to related documents are correct and bidirectional.

## Open Questions

- Confirm parameter naming (`w` vs `width`, `q` vs `quality`) against whatever convention `docs/API/01-API-STANDARDS.md` settles on before implementation locks it in.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/IMAGE-DELIVERY-PROTOCOL/README.md` (category index)
- `docs/API/13-IMAGE-TRANSFORMATION-API.md` (the API-contract framing of this protocol)
- `docs/IMAGE-PROCESSING/` (the engine that implements the pipeline this protocol defines)
- `docs/CDN/` (edge-layer consumer of `18-CACHE-KEY-SPECIFICATION.md`)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made)
