# 21 - Signed URL Protocol

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Define the signed-URL scheme for private/protected images at the protocol level (the algorithm itself is owned by `docs/SECURITY/12-SIGNED-URL.md`; this document defines how it's carried in the URL).

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Key Topics To Specify

- Signature covers the full canonical request: `asset_id + canonical_transformation_parameters + expiry + tenant/application`, so an attacker cannot reuse a valid signature with different transformation parameters (e.g. swap `w=800` for `w=8000` to force expensive regeneration) or against a different tenant.
- Define exact query parameter names (`expires=`, `signature=`) and that they are excluded from the *cache key* material (two different valid signatures for the same otherwise-identical request must hit the same cache entry) while still being fully re-verified on every request, cache hit or miss.

## Reference Example

```
https://img.example.com/v1/assets/abc
    ?w=800
    &h=600
    &fit=cover
    &expires=1799999999
    &signature=xxxxx
```
```
signature = HMAC(
    secret,
    asset_id + canonical_transformation + expiry + tenant_id
)
```
Because the signature covers the canonicalized transformation, not the raw
query string, `?w=800&h=600&...&signature=X` and a reordered-but-equivalent
query string with the same `signature=X` must verify identically -- the
signature check normalizes first, exactly like the cache key does.

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
