# 04 - Transformation Parameters

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The single authoritative table of every parameter this protocol accepts:
name, aliases, type, accepted range/values, default, and which other
parameters it interacts with. Every other document -- including
`docs/API/13-IMAGE-TRANSFORMATION-API.md` -- defers to this table and must
never re-specify a parameter independently.

## Category Mandate

This is the platform's primary contract, on equal footing with API/ -- not a
sub-topic of it. It defines the wire-level protocol that connects asset ->
transformation -> cache -> CDN -> consumer. `API/10-ASSET-API.md` and
`API/11-UPLOAD-API.md` govern how an asset is *managed*; this category
governs how an asset is *consumed*.

---

## Design principle: follow the standards, then the consensus

Two rules produced every name and value below, in this order (`ADR-012`):

1. **Where a real standard exists, follow the standard, not a vendor.** The
   `fit` vocabulary is CSS `object-fit` (CSS Images Module Level 3), because
   that is an actual W3C specification every frontend developer already
   knows. Content negotiation follows RFC 9110 `Accept`/`Vary`; responsive
   sizing is designed to drop into HTML `srcset`/`sizes` (WHATWG).
2. **Where no standard exists, follow the largest intersection across
   providers.** Short canonical names (`w`, `h`, `ar`, `q`, `f`, `g`, `dpr`,
   `bg`) are the forms that imgix, Cloudflare Images, Cloudinary, and
   ImageKit agree on. Long forms are accepted as aliases because Cloudflare
   accepts both and they read better in hand-written URLs.

This is deliberately an unoriginal parameter set. A protocol that multiple
independent implementations must agree on byte-for-byte earns nothing from
novelty, and a consumer migrating from another provider should find our
names unsurprising.

### Verified provider survey

Confirmed against each vendor's official documentation (2026-09-18):

| Concept | imgix | Cloudflare Images | Cloudinary | ImageKit | Ours |
|---|---|---|---|---|---|
| URL form | query string | path, comma-separated | path, `w_400,c_fill` | path, `tr:w-300` | **query string** |
| Width | `w` | `width` / `w` | `w` | `w` | **`w`** |
| Height | `h` | `height` / `h` | `h` | `h` | **`h`** |
| Aspect ratio | `ar` | -- | `ar` | `ar` | **`ar`** |
| Fit | `fit` | `fit` | `c` | `c` / `cm` | **`fit`** |
| Gravity | `crop` | `gravity` / `g` | `g` | `fo` | **`g`** |
| Quality | `q` | `quality` / `q` | `q`, `q_auto` | `q` | **`q`** |
| Format | `fm` | `format` / `f` | `f`, `f_auto` | `f` | **`f`** |
| DPR | `dpr` | `dpr` (max 2) | `dpr` | `dpr` (0.1-5) | **`dpr`** |
| Background | `bg` | `background` | `b` | `bg` | **`bg`** |
| Blur | `blur` | `blur` (0-250) | `e_blur` | `bl` | **`blur`** |

Where the survey disagreed, the choice and its reason are noted in the
table below.

---

## The parameter table

Canonical name is what the normalizer emits and what enters `params_hash`.
Aliases are accepted on input and resolved away before hashing
(`03-TRANSFORMATION-URL-SPECIFICATION.md`).

### Sizing

| Canonical | Aliases | Type | Accepted | Default | Notes |
|---|---|---|---|---|---|
| `w` | `width` | integer | `1`..`MAX_DIMENSION` (8192) | none | Output width in px, before `dpr` |
| `h` | `height` | integer | `1`..`MAX_DIMENSION` (8192) | none | Output height in px, before `dpr` |
| `ar` | `aspect`, `ratio` | ratio | `W:H`, each `1`..`1000` | none | Requires **exactly one** of `w`/`h` |
| `dpr` | -- | decimal | `0.5`..`3`, one decimal place | `1` | Multiplies `w`/`h` after `ar` resolution |
| `fit` | -- | enum | see below | `scale-down` | |
| `g` | `gravity`, `position`, `focus`, `fo`, `crop` | enum or point | see below | `center` | Only meaningful for `fit=cover`/`contain` |
| `rect` | -- | `x,y,w,h` | integers within source bounds | none | Explicit region, applied **before** resize |

Hard bounds, all from `docs/PLAN/15-QUOTA-LIMITS.md` and enforced as
constants, never inline literals:

- `w`, `h` each at most `8192` (`TRANSFORM_MAX_DIMENSION_PX`).
- Effective output pixels (`w x h x dpr^2`) at most `25,000,000`. A request
  exceeding it is `400 invalid_transform_param`, not a silent clamp -- a
  silent clamp returns an image of dimensions the caller did not ask for,
  which is worse than an error.
- Upscaling beyond the original is allowed only by `fit=cover`, `contain`,
  `fill`, `inside`, `outside`; `scale-down` and `none` never upscale.

### `fit` values

CSS `object-fit` is the normative vocabulary. Two extra values (`inside`,
`outside`) exist because they change the *output dimensions* rather than how
content is placed in a fixed box, which CSS has no equivalent for; both are
named after the widely-understood sharp/libvips terms and carry the imgix
aliases.

| Value | Meaning | Output size | Source of the name |
|---|---|---|---|
| `scale-down` | Fit inside `w`x`h`, never upscale | may be smaller | CSS, Cloudflare; imgix `max` |
| `cover` | Fill `w`x`h` exactly, crop the overflow | exactly `w`x`h` | CSS, Cloudflare; imgix `crop` |
| `contain` | Fit inside `w`x`h`, pad to exact size with `bg` | exactly `w`x`h` | CSS; Cloudflare `pad`; imgix `fill` |
| `fill` | Stretch to `w`x`h`, ignore aspect ratio | exactly `w`x`h` | CSS; Cloudflare `squeeze`; imgix `scale` |
| `inside` | Fit inside `w`x`h`, no padding, may upscale | may be smaller | imgix `clip` (its default) |
| `outside` | Cover `w`x`h`, no crop, may exceed | may be larger | imgix `min` |
| `none` | No resize | source size | CSS |

Accepted aliases: `max`->`scale-down`, `crop`->`cover`, `pad`->`contain`,
`squeeze`->`fill`, `scale`->`fill`, `clip`->`inside`, `min`->`outside`.

**Default is `scale-down`,** stated explicitly because leaving it to "what
the library does" is exactly what this document's acceptance criteria
forbid. Reasoning: it is the only non-destructive default -- it never crops
content the caller did not ask to lose, and never upscales into a blurry
image that costs more bytes than the original. It matches Cloudflare's
vocabulary and imgix's `max`. Note that it is *not* sharp's default
(`cover`), so the engine's default must be overridden explicitly in code,
and a test must pin that.

Changing this default later is a **breaking** change under
`30-VERSIONING.md`, because every existing URL that omits `fit` would begin
returning different bytes.

### `g` (gravity) values

| Value | Meaning |
|---|---|
| `center` (default) | Geometric center |
| `top`, `bottom`, `left`, `right` | Edge-anchored |
| `top-left`, `top-right`, `bottom-left`, `bottom-right` | Corner-anchored |
| `auto` | Platform-chosen salient region (`docs/IMAGE-PROCESSING/08-AUTO-CROP.md`) |
| `face` | Largest detected face (`docs/IMAGE-PROCESSING/07-FOCAL-POINT.md`) |
| `Xx,Yy` as `x,y` | Fractional focal point, each `0.0`..`1.0` |

Canonical name is `g`, matching Cloudflare and Cloudinary. `position` is
accepted as an alias but is **not** canonical: it is sharp's internal API
name, and letting the processing library's vocabulary become the public
protocol is the same abstraction leak `ADR-001` forbids for storage
(`ADR-012`).

`auto` and `face` are non-deterministic across engine versions. They are
therefore resolved to a concrete rectangle at normalization time, and that
rectangle -- not the literal string `auto` -- enters `params_hash`; see
`03-TRANSFORMATION-URL-SPECIFICATION.md`.

### Encoding

| Canonical | Aliases | Type | Accepted | Default | Notes |
|---|---|---|---|---|---|
| `f` | `format`, `fm` | enum | `auto`, `avif`, `webp`, `jpeg`, `png` | `auto` | `ADR-008` governs `auto` |
| `q` | `quality` | integer or `auto` | `1`..`100`, `auto` | `auto` | Ignored for `png` |
| `bg` | `background` | color | `RRGGBB`, `RRGGBBAA`, CSS named color | transparent, else `FFFFFF` | Used by `fit=contain`, `rot`, alpha flattening |

`f=auto` negotiates from `Accept` in the order AVIF, WebP, JPEG
(`ADR-008`, `12-FORMAT-NEGOTIATION.md`). `q=auto` resolves to a
per-format value from a **versioned** quality table -- looked up per format,
so a fallback response takes the WebP row rather than the AVIF row.

`f=auto` additionally carries a **specified degradation**: when it resolves
to `avif` and the AVIF derivative does not exist yet, the response is the
cheapest format the client accepts, briefly cached, while AVIF is generated
in the background (`ADR-015`, `12-FORMAT-NEGOTIATION.md`). An **explicit**
`f=avif` never degrades -- it is generated synchronously at full effort or it
fails. This is the only place in the protocol where `auto` and an explicit
value differ in more than the chosen value, and it is why the asymmetry is
stated in the table rather than left to the negotiation document alone.

Both `auto` values are resolved to concrete values before hashing. This is
not a detail -- it is the rule that prevents a silent correctness bug: if
the literal `auto` entered `params_hash`, then retuning the quality table
or the format ladder would leave every cache entry keyed identically while
the bytes they should contain had changed, and the edge would serve the old
encoding indefinitely with no way to tell.

### Effects (additive, optional in v1)

| Canonical | Aliases | Type | Accepted | Default |
|---|---|---|---|---|
| `blur` | `bl` | integer | `0`..`100` | `0` |
| `sharpen` | `sharp` | integer | `0`..`100` | `0` |
| `rot` | `rotate` | enum | `0`, `90`, `180`, `270`, `auto` | `auto` |
| `flip` | -- | enum | `h`, `v`, `hv` | none | |

`blur` and `sharpen` use a platform-normalized `0..100` scale rather than a
library sigma. There is no provider consensus to follow here -- Cloudflare
uses `0..250`, imgix a different range again -- so a bounded, unit-free
scale is chosen and the mapping to the engine's sigma is documented in
`docs/IMAGE-PROCESSING/11-IMAGE-OPTIMIZATION.md`. The mapping is versioned:
changing it is a breaking change.

`rot=auto` applies the EXIF orientation, which is the only safe default
given metadata is stripped (`docs/IMAGE-PROCESSING/13-ORIENTATION.md`) --
without it, stripping EXIF would silently rotate images.

### Delivery

| Canonical | Aliases | Type | Accepted | Default | Notes |
|---|---|---|---|---|---|
| `dl` | `download` | string | filename, `1`..`255` | none | Sets `Content-Disposition: attachment` |
| `exp` | -- | integer | unix seconds | none | Signed URLs only (`21-SIGNED-URL-PROTOCOL.md`) |
| `sig` | `s` | string | hex | none | Signed URLs only |

`dl` takes an untrusted filename. It is header-encoded and any control
character or newline is rejected, per
`docs/ENGINEERING/13-SECURITY-CODING-RULES.md` section 5.

### Compatibility aliases (migration)

Accepted, resolved away before hashing, and never emitted:

| Input | Resolves to | Source dialect |
|---|---|---|
| `auto=format` | `f=auto` | imgix |
| `auto=compress` | `q=auto` | imgix |
| `auto=format,compress` | `f=auto&q=auto` | imgix |
| `fm=` | `f=` | imgix |
| `crop=` (as gravity) | `g=` | imgix |
| `c=fill` | `fit=cover` | Cloudinary |
| `c=fit` | `fit=inside` | Cloudinary |
| `c=scale` | `fit=fill` | Cloudinary |
| `c=pad` | `fit=contain` | Cloudinary |
| `fo=` | `g=` | ImageKit |
| `bl=` | `blur=` | ImageKit |

The alias map is **data, not branching logic**: a table in
`packages/transform-params`, which is what makes these compatibility modes
nearly free and directly serves `docs/DEVELOPER/13-MIGRATION.md`. Adding a
dialect is a row, not a code path.

---

## Parameter interactions

The interaction rules, stated as the testable matrix this document's
acceptance criteria require:

| Combination | Behavior |
|---|---|
| `ar` + exactly one of `w`/`h` | The other dimension is derived |
| `ar` + both `w` and `h` | `400 invalid_parameter_combination` -- over-specified and ambiguous |
| `ar` + neither `w` nor `h` | `400 invalid_parameter_combination` |
| neither `w`, `h`, nor `ar` | No resize; other parameters still apply |
| `dpr` with no `w`/`h` | `dpr` ignored, reported as ignored |
| `g` with `fit` other than `cover`/`contain` | Ignored, reported as ignored |
| `bg` with `fit` other than `contain`, no `rot`, alpha-capable output | Ignored, reported as ignored |
| `q` with `f=png` | Ignored (png is lossless); mapped to compression effort instead |
| `rect` + `w`/`h` | `rect` extracts first, then resize applies to the extracted region |
| `rect` outside source bounds | `400 invalid_transform_param` |
| `f=auto` + no `Accept` header | Falls back to `jpeg` |
| `exp`/`sig` present | Verified before any other parameter is acted on (`23-PRIVATE-IMAGE-DELIVERY.md`) |

"Reported as ignored" means the parameter is dropped from the canonical form
and listed in the `X-Image-Ignored-Params` response header -- see
`03-TRANSFORMATION-URL-SPECIFICATION.md` for why ignoring rather than
rejecting, and how the header preserves typo detection.

Pipeline order (which parameter is applied when) is **not** defined here.
It is fixed by `16-TRANSFORMATION-PIPELINE.md`, and the two documents must
agree: this one says what a parameter means, that one says when it runs.

---

## Optional: bounded dimension space

`w` and `h` accept arbitrary integers by default, matching every surveyed
provider except Next.js. A per-project setting may instead **snap** them up
to the nearest rung of a ladder (`ADR-014`):

```
16, 32, 48, 64, 96, 128, 256, 384,
640, 750, 828, 1080, 1200, 1920, 2048, 3840
```

That default ladder is Next.js's `imageSizes` + `deviceSizes`, because it is
the most widely deployed width ladder on the web and therefore the one most
consumers' `srcset` output already aligns with.

When snapping is on, the **snapped** value enters `params_hash`, so
`w=401` and `w=420` become one derivative, one cache entry, one stored
object. The cost lever this represents is large -- it collapses derivative
cardinality, which is the platform's real cost driver -- but it is off by
default because a developer who asks for 401px and receives 640px is
surprised, and surprise in a protocol is worse than cost.

---

## Reference examples

Equivalent requests -- all four canonicalize identically and therefore share
one `params_hash`, one cache key, and one stored object:

```
?w=800&h=600&fit=cover&g=center&q=80&f=auto
?h=600&q=80&f=auto&fit=cover&w=800&g=center
?width=800&height=600&fit=crop&position=center&quality=80&format=auto
?w=800&h=600&fit=cover&g=center&q=80&auto=format
```

Canonical form (sorted, aliases resolved, defaults explicit, `auto` values
resolved against an `Accept: image/avif,...` request):

```
dpr=1&f=avif&fit=cover&g=center&h=600&q=80&w=800
```

Responsive `srcset` usage, which is the shape the parameter design is
optimized for:

```html
<img
  src="https://cdn.example.com/i/01JABCDEF?w=828&fit=scale-down"
  srcset="https://cdn.example.com/i/01JABCDEF?w=640&fit=scale-down 640w,
          https://cdn.example.com/i/01JABCDEF?w=828&fit=scale-down 828w,
          https://cdn.example.com/i/01JABCDEF?w=1200&fit=scale-down 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="">
```

Note `dpr` is absent there on purpose: `srcset` with `w` descriptors and
`sizes` already lets the browser account for device pixel ratio, and adding
`dpr` on top double-counts it. `dpr` exists for fixed-size images where
`srcset` uses `x` descriptors instead.

---

## Acceptance Criteria

- [x] Every parameter has exactly one authoritative source -- this table.
      `docs/API/13-IMAGE-TRANSFORMATION-API.md` references it and defines
      nothing itself.
- [x] Every default is stated explicitly, including `fit=scale-down`,
      `q=auto`, `f=auto`, `g=center`, `dpr=1`, and `rot=auto`, with the
      reasoning for the non-obvious ones.
- [x] Every parameter's interaction with every other is in the interaction
      matrix, and each row is testable.
- [x] Every name traces to a standard (CSS `object-fit`, RFC 9110, WHATWG
      `srcset`) or to the verified provider survey, not to preference.
- [x] Cross-references to `03`, `12`, `16`, `17`, `18`, `21`, `23`, `30`,
      `docs/IMAGE-PROCESSING/`, and `docs/PLAN/15-QUOTA-LIMITS.md` are
      correct.

## Open Questions

- The `q=auto` per-format quality table and the `blur`/`sharpen` sigma
  mapping are both versioned tables whose **values** are set by `P3-01`'s
  benchmark and `docs/IMAGE-PROCESSING/09-QUALITY-CONTROL.md`. The
  versioning mechanism is settled here; the numbers are not.
- `g=auto` and `g=face` resolution needs a stability guarantee across engine
  upgrades (`P3-06`): a libvips or model update that moves the salient
  rectangle changes the output for an unchanged URL. Candidate answer:
  persist the resolved rectangle with the derivative and reuse it.
- `rect`, `flip`, `sharpen`, and `dl` are specified but may be deferred past
  v1 by `docs/PLAN/02-PRODUCT-SCOPE.md`. Specified now so they cannot be
  added later with a different shape.
- Whether a path-segment URL form is also offered (provably equivalent, per
  `docs/PLAN/12-IMAGE-QUERY-SPECIFICATION.md`) is a `P4-01` decision taken
  together with the CDN choice, since some CDNs exclude query strings from
  the cache key by default.

## Related Documents

- `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md` (how these are parsed and canonicalized)
- `docs/IMAGE-DELIVERY-PROTOCOL/16-TRANSFORMATION-PIPELINE.md` (when each is applied)
- `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/12-FORMAT-NEGOTIATION.md`, `30-VERSIONING.md`
- `docs/API/13-IMAGE-TRANSFORMATION-API.md` (defers to this document)
- `docs/PLAN/12-IMAGE-QUERY-SPECIFICATION.md` (product-level query surface)
- `docs/PLAN/15-QUOTA-LIMITS.md` (the numeric bounds)
- `docs/IMAGE-PROCESSING/` (the engine implementing these semantics)
- `docs/DEVELOPER/13-MIGRATION.md` (served by the compatibility alias table)
- `MEMORY/DECISIONS.md` (`ADR-008`, `ADR-012`, `ADR-013`, `ADR-014`)
