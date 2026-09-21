# 03 - Transformation URL Specification

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Define, formally, how a transformation query string is parsed and
canonicalized -- the single most cache-critical document in this category.
`04-TRANSFORMATION-PARAMETERS.md` says what each parameter *means*; this
document says how a raw URL becomes the one canonical form that
`17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`, and
`docs/STORAGE/04-OBJECT-NAMING.md` all depend on.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a
sub-topic of it. `API/13-IMAGE-TRANSFORMATION-API.md` defers to this
category as the normative source and simply references it.

---

## The URL form

```
https://{delivery-host}/i/{asset_id}?{transformation-query}
```

Query string, not path segments -- matching imgix and Next.js, and diverging
from Cloudinary, Cloudflare Images, and ImageKit, which encode
transformations in the path. The reason is that a query string is the
REST-native form, needs no escaping scheme of its own, and composes
trivially in `srcset`. The cost is operational and real: **several CDNs
exclude the query string from the cache key by default, or strip it
outright.** Getting that configuration wrong produces the worst possible
failure -- every visitor served whichever variant happened to be cached
first. `P4-01` owns that configuration and `docs/CDN/01-CACHE-KEY.md` owns
the verification, and a path-segment form remains an open option there
(`docs/PLAN/12-IMAGE-QUERY-SPECIFICATION.md`).

## The canonicalization algorithm

Deterministic, pure, and total. Given a raw query string and the request's
negotiation context, it returns either one canonical parameter object or a
rejection. The steps run in this exact order; the order is part of the
contract because several steps are not commutative.

```
 1. PARSE          Split on '&', split each pair on the first '='.
                   Percent-decode. Duplicate keys: last occurrence wins.
 2. PARTITION      Split keys into: known transformation parameters,
                   near-miss candidates, and foreign parameters.
 3. REJECT         Near-miss keys -> 400 invalid_transform_param.
 4. DISCARD        Foreign keys -> dropped; recorded for the
                   X-Image-Ignored-Params header. Never enter the cache key.
 5. ALIAS          Resolve alias names and alias values to canonical
                   (width->w, fm->f, crop->g, c=fill->fit=cover, ...).
 6. COERCE         Type-coerce each value; reject on failure.
 7. VALIDATE       Range/enum-check each value; reject on failure.
 8. COMBINE        Apply the interaction matrix: derive from `ar`, reject
                   over-specified combinations, drop no-op parameters
                   (recording them as ignored).
 9. RESOLVE        Replace every deferred value with a concrete one:
                   f=auto   -> a concrete format, from the Accept bucket
                   q=auto   -> a concrete integer, from the versioned table
                   g=auto   -> a concrete rectangle
                   g=face   -> a concrete rectangle
                   rot=auto -> a concrete angle, from EXIF
10. DEFAULT        Insert every omitted parameter's explicit default.
11. SNAP           If the project enables the dimension ladder, snap w/h up
                   to the nearest rung (ADR-014).
12. CLAMP-CHECK    Re-verify the effective pixel budget after dpr and snap.
13. ORDER          Sort canonical keys lexicographically (ASCII).
14. SERIALIZE      key=value pairs joined by '&'. This string is the input
                   to computeParamsHash().
```

### Step 9 is the one that is easy to get wrong

`f=auto`, `q=auto`, `g=auto`, `g=face`, and `rot=auto` are all requests to
*decide something later*. Every one of them must be resolved to a concrete
value **before** step 14, so the concrete value -- never the literal string
`auto` -- is what gets hashed.

If `auto` were hashed as `auto`, then retuning the quality table, changing
the format ladder, or upgrading the saliency model would leave every
existing cache entry and stored object keyed identically while the bytes
they ought to contain had changed. The edge would keep serving the old
encoding forever, and nothing in the system could detect it. This is the
same class of bug `ADR-004` exists to prevent, one layer up.

Consequence, stated so it is not discovered later: **two requests for the
same URL from clients with different `Accept` headers are two different
derivatives**, because `f=auto` resolves differently. That is correct and
intended; `18-CACHE-KEY-SPECIFICATION.md` and `12-FORMAT-NEGOTIATION.md`
handle it via the `Accept` bucket below.

Note also what step 9 does **not** decide: resolution is about what the
caller asked for, not about what currently exists. `f=auto` resolving to
`avif` fixes the `params_hash` of an AVIF derivative even when that
derivative has not been generated yet; whether the response carries AVIF
bytes or a briefly-cached cheaper fallback is a delivery-time question
answered by `12-FORMAT-NEGOTIATION.md` (`ADR-015`). Canonicalization is
unaffected by availability, and must stay that way -- a hash that depended
on what happened to be in storage would not be canonical.

### The `Accept` bucket

`Vary: Accept` on a raw `Accept` header is a cache-fragmentation hazard: the
header has an enormous number of distinct real-world values, and each one
would become its own edge cache entry for the same image.

So the raw header never reaches the cache key. It is first collapsed to one
of exactly three buckets, in `ADR-008`'s priority order:

| Accept contains | Bucket |
|---|---|
| `image/avif` | `avif` |
| `image/webp` (and not avif) | `webp` |
| neither | `jpeg` |

The bucket is what `f=auto` resolves to, and the resolved concrete format is
what enters `params_hash`. An explicit `f=webp` bypasses negotiation
entirely and is unaffected by the header.

## The equivalence guarantee

> **Any two request URLs that canonicalize to the same string MUST be
> treated as the same transformation request** -- the same `params_hash`,
> the same `derivative_id`, the same cache key, the same stored object --
> regardless of parameter order, alias choice, duplicate keys, foreign
> parameters, or dialect.

This is stated as a testable rule and verified by the golden vector fixture
(`docs/ENGINEERING/09-TESTING-CONVENTIONS.md`, suite 2). The fixture is
append-only: a changed expected hash is a released-contract break requiring
an ADR, not a re-recorded fixture.

## Unknown parameters: partition, do not blanket-reject

Earlier drafts of this document specified `400` for **any** unknown
parameter, reasoning that silently ignoring a typo returns a different,
wrong image without telling anyone. That reasoning is sound but the blanket
rule has a concrete production failure mode, and every surveyed provider --
imgix, Cloudflare Images, Cloudinary, ImageKit -- ignores unknown
parameters instead.

The failure mode: image URLs get shared, and things append tracking
parameters to shared URLs. `?utm_source=`, `?fbclid=`, `?gclid=`, a
referrer-stripping proxy's own additions -- none of which the developer
using our platform controls. Under a blanket rule, every one of those turns
a working image into a `400`. The platform would be broken by traffic it has
no say over.

So parameters partition three ways (`ADR-013`):

| Class | Test | Behavior |
|---|---|---|
| **Known** | Exact match on a canonical name or alias | Processed |
| **Near-miss** | Edit distance <= 2 from a known name, or a known name with different case (`Width`, `widht`, `quallity`, `dpr_`) | **`400 invalid_transform_param`**, naming the suspected intent |
| **Foreign** | Everything else (`utm_source`, `fbclid`, `v`, `t`) | Ignored, excluded from the cache key, listed in `X-Image-Ignored-Params` |

This keeps the typo protection that motivated the strict rule -- `widht=400`
still fails loudly, which is the case that actually bites developers -- while
a tracking parameter is harmless. The `X-Image-Ignored-Params` response
header makes the ignoring observable, so a developer debugging "why is my
parameter not working" gets an answer from the response itself rather than
from support.

A project may opt into `strict_parameters`, which rejects foreign
parameters too. Off by default, for the reason above.

## Rejection behavior

Every rejection is a `400` with an error code from
`docs/ENGINEERING/06-ERROR-RESPONSE-STANDARDS.md` and a `details` entry
naming the field and a machine-readable reason:

| Condition | Code | `details.reason` |
|---|---|---|
| Near-miss parameter name | `invalid_transform_param` | `unknown_parameter` |
| Value fails type coercion | `invalid_transform_param` | `type` |
| Value outside accepted range | `invalid_transform_param` | `out_of_range` |
| Value not in accepted enum | `invalid_transform_param` | `not_allowed` |
| Over-specified combination | `invalid_parameter_combination` | `over_specified` |
| Pixel budget exceeded | `invalid_transform_param` | `pixel_budget_exceeded` |
| `rect` outside source bounds | `invalid_transform_param` | `out_of_bounds` |

The error body never echoes the received value (it may be attacker-supplied
or, on a mis-built URL, a secret placed in the wrong parameter), and the
response carries an explicit `Cache-Control` so the edge neither caches the
`400` forever nor re-asks the origin on every request
(`19-CACHE-CONTROL.md`, `24-ERROR-AND-FALLBACK.md`).

## Reference example

These two requests must canonicalize identically and therefore share one
cache key:

```
w=800&h=600&fit=cover&g=center&q=80&f=auto
h=600&q=80&f=auto&fit=cover&w=800&g=center
```

So must these, written in three different provider dialects plus a tracking
parameter:

```
?width=800&height=600&fit=crop&position=center&quality=80&format=auto
?w=800&h=600&c=fill&g=center&q=80&auto=format&utm_source=newsletter
?w=800&h=600&fit=cover&crop=center&q=80&fm=auto
```

Canonical serialization, for a client sending `Accept: image/avif,image/webp,*/*`:

```
dpr=1&f=avif&fit=cover&g=center&h=600&q=80&w=800
```

and `X-Image-Ignored-Params: utm_source` on the second one.

The canonicalization function is the single shared dependency of
`18-CACHE-KEY-SPECIFICATION.md`, `17-DERIVATIVE-IDENTITY.md`, and
`docs/STORAGE/04-OBJECT-NAMING.md` -- implemented once in
`packages/transform-params`, imported everywhere, never reimplemented per
service (`ADR-004`, `ADR-009`).

## Acceptance Criteria

- [x] The canonicalization algorithm is specified as an ordered, total
      procedure, with the reason the order matters.
- [x] Deferred (`auto`) values are required to resolve to concrete values
      before hashing, with the failure mode that rule prevents stated.
- [x] The `Accept` header is required to collapse to a three-value bucket
      before reaching any cache key.
- [x] Unknown-parameter behavior is specified per class, with rejection
      codes and reasons, and each row is testable.
- [x] The equivalence guarantee is stated as one testable rule, bound to the
      golden vector suite.
- [x] Every rule here is covered by a conformance test
      (`37-PROTOCOL-TESTING.md`) or explicitly marked operational.

## Open Questions

- Near-miss detection: tuned in `P2-01` (ADR-023) to "case difference
  always; edit distance <= 2 for names of 5+ characters, <= 1 for 3-4, never
  for 1-2" -- a flat <= 2 rejected `v` and `t`, this document's own examples
  of foreign parameters. `P3-02` extends the test to every known-name pair.
- Whether `X-Image-Ignored-Params` is emitted in production or only when a
  debug flag is present is a `P4-01` decision -- it is a response header on
  a cached object, so it interacts with the edge.
- A path-segment URL form, provably equivalent to the query form, stays open
  pending the CDN choice in `P4-01`.
- Persisting the resolved `g=auto`/`g=face` rectangle alongside the
  derivative (so an engine upgrade cannot silently move it) is proposed in
  `04-TRANSFORMATION-PARAMETERS.md`'s open questions and needs a decision in
  `P3-06`.

## Related Documents

- `docs/IMAGE-DELIVERY-PROTOCOL/README.md` (category index)
- `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md` (the parameter table)
- `docs/IMAGE-DELIVERY-PROTOCOL/12-FORMAT-NEGOTIATION.md` (the Accept bucket)
- `docs/IMAGE-DELIVERY-PROTOCOL/16-TRANSFORMATION-PIPELINE.md` (application order)
- `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/19-CACHE-CONTROL.md`, `24-ERROR-AND-FALLBACK.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/37-PROTOCOL-TESTING.md`
- `docs/API/13-IMAGE-TRANSFORMATION-API.md` (the API-contract framing)
- `docs/CDN/01-CACHE-KEY.md` (edge-layer consumer)
- `docs/STORAGE/04-OBJECT-NAMING.md` (storage-layer consumer)
- `docs/ENGINEERING/06-ERROR-RESPONSE-STANDARDS.md` (error shape)
- `MEMORY/DECISIONS.md` (`ADR-004`, `ADR-008`, `ADR-009`, `ADR-012`, `ADR-013`, `ADR-014`)
