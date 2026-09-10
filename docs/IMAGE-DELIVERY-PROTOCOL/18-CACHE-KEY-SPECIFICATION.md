# 18 - Cache Key Specification

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

The most cache-critical document in the platform: the exact, reproducible algorithm for deriving a cache key from a request.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- `CACHE_KEY = hash(asset_id, asset_version, normalized_transformation, output_format)` -- normalized_transformation is exactly the canonical output of `03-TRANSFORMATION-URL-SPECIFICATION.md`, never the raw query string.
- Include `tenant_id`/`application_id` in the key material (even though `asset_id` is already tenant-scoped) as defense-in-depth against a cache-layer bug ever colliding two tenants' keys -- cross-reference `docs/CDN/01-CACHE-KEY.md` and `MEMORY/DECISIONS.md` ADR-004.
- Give one fully worked example end to end so implementers can unit-test their own hash function against a known-correct output.

## Reference Example

```
asset:    abc123
version:  4
width:    800
height:   600
fit:      cover
position: center
format:   webp
quality:  80

-> cache-key: abc123:v4:w800:h600:cover:center:webp:q80
```
```
Origin
  |
  v
Image Processor
  |
  v
Cache
  |
  v
CDN Edge
```
This is the same key material `docs/STORAGE/04-OBJECT-NAMING.md` uses for
the derivative's object-storage path -- one canonicalization function, two
consumers, per `MEMORY/DECISIONS.md` ADR-004.

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
