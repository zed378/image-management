# 13 - Image Transformation API

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

> **Normative source:** every parameter name, alias, accepted value,
> default, and interaction rule is defined by
> `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md`, and the
> parsing/canonicalization rules by
> `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md`
> (both Final; see `ADR-012`, `ADR-013`, `ADR-014`). This document describes
> the API-contract framing only -- endpoint shape, status codes, headers --
> and MUST NOT redefine a parameter. If the two ever disagree, the protocol
> category wins and this document is the bug.

## Purpose

Specify image transformation api for the Image Management & Delivery Platform. Enumerate every transformation parameter (width, height, aspect ratio, crop, fit, fill, contain, cover, focal point, gravity, quality, format, DPR, rotation, background) with its accepted values, defaults, and how it composes with the other parameters.

## Category Mandate

The platform is API-first. Every capability exposed to a consumer application is defined here as a versioned, documented HTTP contract before it is implemented. These documents are the source of truth for request/response shapes, status codes, and error formats -- SDKs and the dashboard are clients of this contract, not the other way around.

## Key Topics To Specify

- Enumerate every transformation parameter (width, height, aspect ratio, crop, fit, fill, contain, cover, focal point, gravity, quality, format, DPR, rotation, background) with its accepted values, defaults, and how it composes with the other parameters.

## Reference Example

Request shape (either form is equivalent and must be):

```
GET /images/{image_id}?width=800&height=600&fit=cover&g=center&quality=80&format=webp&dpr=2
```

or as a fully declarative CDN-facing URL:

```
https://img.example.com/abc123?w=800&h=600&fit=cover&g=center&q=80&format=webp
```

Parameters this endpoint must define precisely (values, defaults, interactions):
resize, scale, crop, fit (cover/contain/fill/scale-down), width, height, aspect
ratio, focal point, position/gravity, quality, format (incl. `format=auto`),
DPR, progressive rendering, compression, metadata stripping, background color
(for `fit=contain`), rotation, orientation handling, and the fallback format
used when the requested format is unsupported by the client.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/API/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
