# 01 - Design Principles

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Fix the non-negotiable design rules the rest of the protocol is built on, so no individual document (e.g. 05-RESIZE-PROTOCOL.md) has to re-justify them.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- **Determinism**: the same `(asset_id, asset_version, normalized_parameters)` tuple always produces the same output bytes (or an acceptably equivalent re-encode for lossy formats) -- this is what makes caching possible at all.
- **Declarative, not imperative**: a consumer describes the *outcome* it wants (a 400x600 cropped, centered, WebP thumbnail), never *how* to get there -- the engine is free to change internally (ImageMagick -> libvips -> Sharp -> a custom engine) without the consumer noticing.
- **Canonical form before everything**: every parameter set has exactly one canonical, normalized representation; cache keys, derivative identity, and signatures are all computed from that canonical form, never from the raw client-supplied query string.
- **Progressive disclosure**: a consumer needs to know almost nothing to get a correct basic thumbnail (`?w=400`), and can opt into arbitrarily precise control (`focus=`, `fit=`, `format=`) only when needed.

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
