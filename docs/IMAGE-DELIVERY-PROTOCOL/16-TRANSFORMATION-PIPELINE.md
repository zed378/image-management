# 16 - Transformation Pipeline

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define the fixed order transformations are applied in -- this is a contract, not an implementation detail, because a different order changes the output.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- Fix the pipeline order once, here, and require every image-engine implementation (current or future) to honor it exactly: Original -> Orientation -> Crop -> Resize -> Position/Focal Point -> Quality -> Format Conversion -> Metadata Strip -> Encode -> Cache -> CDN.
- State why order matters concretely: applying orientation after crop would crop the wrong region on a rotated source; applying quality/format before resize wastes compute re-encoding pixels that get thrown away.
- This document is what lets the engine be swapped (ImageMagick -> libvips -> Sharp -> a custom engine) without changing API-visible behavior -- every engine adapter is tested against golden-image output for this exact pipeline, per `docs/TESTING/04-IMAGE-TRANSFORMATION-TESTING.md`.

## Reference Example

```
Original
   |
   v
Orientation
   |
   v
Crop
   |
   v
Resize
   |
   v
Position / Focal Point
   |
   v
Quality
   |
   v
Format Conversion
   |
   v
Metadata Strip
   |
   v
Encode
   |
   v
Cache
   |
   v
CDN
```

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
