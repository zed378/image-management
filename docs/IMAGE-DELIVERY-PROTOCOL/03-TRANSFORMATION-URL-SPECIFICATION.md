# 03 - Transformation URL Specification

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define, formally, how a transformation query string is parsed and canonicalized -- the single most cache-critical document in this category.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- Specify the canonicalization algorithm precisely: parameter name aliases resolved (e.g. `width`==`w`), values type-coerced and range-validated, parameters sorted into a fixed order, defaults made explicit -- output is one canonical string or object, used everywhere downstream (cache key, derivative identity, signature).
- State the equivalence guarantee as a testable rule: any two query strings that canonicalize to the same output MUST be treated as the same transformation request, regardless of client-supplied parameter order or alias choice.
- Define rejection behavior for unknown parameters (reject with `400`, do not silently ignore -- silent ignoring masks client typos as a different, wrong image).

## Reference Example

These two requests must canonicalize identically and therefore share one
cache key:
```
w=800&h=600&fit=cover&position=center&q=80&format=auto
```
```
h=600&q=80&format=auto&fit=cover&w=800&position=center
```
The canonicalization function is the single shared dependency of
`18-CACHE-KEY-SPECIFICATION.md`, `17-DERIVATIVE-IDENTITY.md`, and
`docs/STORAGE/04-OBJECT-NAMING.md` -- implement it once, import it
everywhere, never reimplement it per service.

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
