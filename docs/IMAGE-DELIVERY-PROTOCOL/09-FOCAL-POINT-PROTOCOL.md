# 09 - Focal Point Protocol

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define a per-asset, normalized-coordinate focal point that crop operations bias toward -- strictly more powerful than named `position=`.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- `focus=x,y` as normalized coordinates in `[0,1]x[0,1]` relative to the original image's top-left corner, e.g. `focus=0.72,0.35` means 72% across, 35% down.
- Focal point can be set manually per asset/version (`PATCH` on the asset, per `docs/IMAGE-PROCESSING/07-FOCAL-POINT.md`) or supplied per-request as an override; per-request always wins over the stored default.
- Define the fallback when `focus=` is supplied together with `fit=contain` (has no cropping to bias, so it's a no-op, not an error) versus with `fit=cover` (fully honored).

## Reference Example

```
+-------------------------------+
|                               |
|        Original Image        |
|                               |
|              *                |
|         focal point           |
|      focus=0.72,0.35          |
|                               |
+-------------------------------+
```
A request for `w=400&h=400&fit=cover&focus=0.72,0.35` keeps the region
around that point in frame regardless of the requested crop box -- strictly
more expressive than the eight named positions in `08-POSITION-PROTOCOL.md`.

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
