# 12 - Format Negotiation

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define `format=` including the `auto` negotiation mode -- the protocol's primary bandwidth-optimization lever.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- Explicit values: `jpeg`, `png`, `webp`, `avif`, `gif` -- always honored exactly as requested, no negotiation.
- `format=auto` (or omitted): negotiate from the request's `Accept` header, preferring AVIF > WebP > JPEG, per `MEMORY/DECISIONS.md` ADR-008.
- Define the `Vary: Accept` response header requirement so CDN/browser caches don't serve one negotiated format to a client that asked for a different one.

## Reference Example

```
Consumer
   |
   | Accept: image/avif,image/webp,image/jpeg
   v
Image Platform
   |
   +-- AVIF supported?  -> yes -> serve AVIF
   +-- else WebP supported? -> yes -> serve WebP
   +-- else -> JPEG fallback
```
`format=auto` is the default; an explicit `format=` parameter always
overrides negotiation entirely.

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
