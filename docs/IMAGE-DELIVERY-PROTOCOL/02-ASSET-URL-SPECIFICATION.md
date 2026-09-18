# 02 - Asset URL Specification

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define the canonical, versioned URL format for referencing an asset, with and without transformation parameters.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- Fix the base path once: `https://img.example.internal/v1/assets/{asset_id}` for the original, the same path plus a query string for any derivative -- there is deliberately no separate URL *shape* for "original" vs. "transformed", only presence or absence of parameters.
- Define what `{asset_id}` accepts (the ULID format from `docs/DATABASE/05-ASSETS.md`) and the exact error returned for a malformed or unknown ID.
- Define how a custom/branded delivery domain (`img.customer.com`) maps back to a tenant/application, per `docs/MULTI-TENANCY/06-CDN-ISOLATION.md`.

## Reference Example

```
Original:
  https://img.example.internal/v1/assets/01JABC...

Transformation:
  https://img.example.internal/v1/assets/01JABC...?w=800&h=600

Fully specified:
  https://img.example.internal/v1/assets/01JABC...
      ?w=800
      &h=600
      &fit=cover
      &g=center
      &q=80
      &format=auto
      &dpr=2
```
This is the reference shape only -- `03-TRANSFORMATION-URL-SPECIFICATION.md`
defines canonicalization formally; do not let any implementation quietly
assume this exact parameter order or naming is load-bearing.

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
