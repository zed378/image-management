# 12 - Image Query Specification

> Category: **Product & Plan** (`docs/PLAN/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Define the declarative query surface consumers use to request a derivative,
at the product level: what kind of interface it is, who it is for, and which
promises it makes. The normative parameter table and canonicalization
algorithm live in `docs/IMAGE-DELIVERY-PROTOCOL/04` and `03`; this document
decides the product questions those two implement.

## Category Mandate

Defines what the platform is, who it is for, and what it must do before any
code is written. Everything under PLAN/ is product intent. Architecture and
API documents implement what PLAN/ decides; they must not silently redefine
it.

---

## The product decision: a query interface, not a resize service

The consumer describes the **outcome** it wants and the platform decides how
to reach it:

```
Original:      4000 x 3000

Consumer asks for:
  w=400&h=400&fit=cover&g=face

Gets:
  400 x 400, cropped around the detected face, encoded as AVIF
  if the requesting browser accepts it, at a quality the platform
  chose, delivered from the edge.
```

Everything in that result the consumer did **not** specify -- the format,
the quality, the crop rectangle, the cache behavior -- is the product. A
resize service makes the caller decide those; a query interface decides them
well and lets the caller override.

## Three product promises the query surface must keep

1. **Unsurprising to anyone who has used a competitor.** A developer
   arriving from imgix, Cloudinary, Cloudflare Images, or ImageKit should
   guess our parameter names correctly on the first try. This is why
   `ADR-012` chose the provider-consensus vocabulary over anything original,
   and why the compatibility alias table exists.
2. **Safe by default.** Omitting parameters must never destroy image
   content. Hence `fit=scale-down` as the default -- it never crops and
   never upscales -- rather than sharp's `cover`, which would silently crop.
3. **Cheap by construction.** Two URLs meaning the same thing must cost one
   transformation and one stored object, no matter how the caller wrote
   them (`ADR-004`). Derivative cardinality, not request volume, is this
   platform's cost driver.

## Form: query string, with a path form left open

v1 offers the query-string form:

```
https://{delivery-host}/i/{asset_id}?w=800&h=600&fit=cover&q=80
```

This matches imgix and Next.js. Cloudinary, Cloudflare Images, and ImageKit
instead encode transformations in the path. If a path-segment form is added,
it MUST be provably equivalent -- the same canonicalization, the same
`params_hash`, proven by a shared conformance fixture, not by inspection.

The decision is deferred to `P4-01` rather than made here because it is
driven by the CDN: some CDNs exclude query strings from the cache key by
default. Product would rather have the cleaner-looking path form; the
protocol does not care, as long as there is exactly one canonicalizer.

## Scope of the query surface in v1

| Capability | v1 | Notes |
|---|---|---|
| Resize (`w`, `h`, `ar`, `dpr`) | Yes | |
| Fit modes (`fit`) | Yes | CSS `object-fit` vocabulary |
| Gravity, incl. `auto` and `face` (`g`) | Yes | `docs/IMAGE-PROCESSING/07`, `08` |
| Format negotiation (`f=auto`) | Yes | `ADR-008` |
| Quality, incl. `q=auto` | Yes | |
| Background (`bg`) | Yes | |
| Explicit region (`rect`) | Yes | |
| Rotation / flip | Yes | `rot=auto` from EXIF is the default |
| Blur / sharpen | Yes | Bounded `0..100` scale |
| Forced download (`dl`) | Yes | |
| Signed URLs (`exp`, `sig`) | Yes | `ADR-006` |
| Overlays, text, watermarks | **No** | Deferred; needs its own protocol design |
| Background removal, generative fill | **No** | Competitors' AI tier; out of v1 scope |
| Video | **No** | `docs/PLAN/02-PRODUCT-SCOPE.md` |
| Arithmetic expressions in values | **No** | ImageKit has them; they complicate canonicalization for little gain |

The "no" rows matter as much as the "yes" rows: each is a thing the
parameter table must not accrete informally later. Adding one is a protocol
change under `docs/IMAGE-DELIVERY-PROTOCOL/30-VERSIONING.md`.

## Product decision: arbitrary widths by default, ladder as an option

`w` and `h` accept arbitrary integers, matching every surveyed provider
except Next.js. A per-project setting may snap them to a discrete ladder
instead (`ADR-014`), collapsing cardinality dramatically.

The product reasoning for the default being *off*: a developer who requests
401px and receives 640px has hit a surprise, and surprise in a public
protocol costs more trust than the snapping saves in cost. The setting
exists because for a large catalog with a generated `srcset`, snapping is
nearly free -- the ladder's default rungs are Next.js's own width list, so a
Next.js consumer's URLs already land on them.

Where this becomes visible to customers is `docs/PLAN/17-PRICING-ENTITLEMENT.md`:
a project that enables snapping generates fewer billable transformations.
That is a legitimate lever to expose rather than hide.

## Reference example

```
Original:      4000 x 3000

Consumer requests:
  w=800&h=600&g=top

Result:
  800 x 600, crop gravity = top, format from Accept, quality chosen
  by the platform

--- smart-crop variant ---

  w=400&h=400&fit=cover&g=face

Result:
  400 x 400 square, centered on the detected face
```

This is the difference between a plain resize service and a *query*
interface: the consumer describes the outcome (a face-centered square
thumbnail) and the platform decides how to get there.
`docs/IMAGE-PROCESSING/07-FOCAL-POINT.md` and `08-AUTO-CROP.md` define how
`g=face` and `g=auto` resolve.

## Acceptance Criteria

- [x] Every default value is stated explicitly, or the document that states
      it is named (`docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md`).
- [x] Every promise here is testable: promise 1 by the compatibility alias
      fixture, promise 2 by a default-behavior test, promise 3 by the golden
      vector suite.
- [x] In-scope and out-of-scope capabilities are both enumerated, so later
      additions are visibly protocol changes.
- [x] Cross-references to `docs/IMAGE-DELIVERY-PROTOCOL/`, `docs/PLAN/15`,
      `docs/PLAN/17`, and `docs/IMAGE-PROCESSING/` are correct.

## Open Questions

- Overlay/watermark support is the most commonly requested capability this
  scope excludes. If it enters the roadmap, it needs its own protocol
  document, not extra parameters bolted onto `04`.
- Whether snapping is exposed as a customer-facing pricing lever or purely
  an internal optimization is a `docs/PLAN/17-PRICING-ENTITLEMENT.md`
  decision.
- The numeric bounds referenced here are owned by
  `docs/PLAN/15-QUOTA-LIMITS.md`; they are currently placeholders pending
  `P7-05`'s load tests.

## Related Documents

- `docs/PLAN/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md`, `docs/PLAN/02-PRODUCT-SCOPE.md`
- `docs/PLAN/15-QUOTA-LIMITS.md`, `docs/PLAN/17-PRICING-ENTITLEMENT.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md` (normative canonicalization)
- `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md` (normative parameter table)
- `docs/IMAGE-DELIVERY-PROTOCOL/30-VERSIONING.md`
- `docs/DEVELOPER/06-IMAGE-QUERY.md`, `docs/DEVELOPER/13-MIGRATION.md`
- `MEMORY/DECISIONS.md` (`ADR-004`, `ADR-008`, `ADR-012`, `ADR-013`, `ADR-014`)
