# Phase 3 -- Image Processing & Transformation API

Goal: the platform's actual core value. Given an asset and a set of
transformation parameters, deterministically produce the requested
derivative. This phase has no CDN in front of it yet (Phase 4) -- correctness
and determinism come first, caching second.

Exit criteria: `GET /v1/images/:assetId?w=800&h=600&fit=cover&format=webp`
returns correct, byte-appropriate image bytes; the same request twice
produces the same `params_hash` and (once Phase 4 lands) the same cache
entry; a documented, tested matrix of fit/position/format/quality
combinations all behave as specified in `docs/API/13-IMAGE-TRANSFORMATION-API.md`.

---

### P3-01: Choose and integrate the image processing engine

- **Depends on:** P0-01
- **Implements:** `docs/ARCHITECTURE/08-IMAGE-PROCESSING-SERVICE.md`, `docs/IMAGE-PROCESSING/00-IMAGE-PROCESSING-OVERVIEW.md`, `docs/IMAGE-PROCESSING/01-SUPPORTED-FORMATS.md`

**Steps**
1. Select the processing library (recommended default: `sharp`, a
   libvips-based Node binding, chosen for speed and broad format support;
   record the decision and the alternatives considered -- e.g. Sharp vs. a
   dedicated Go/Thumbor-style service -- in `MEMORY/DECISIONS.md`).
2. Stand up the Image Processing Service as its own deployable unit,
   reachable only from the Asset/Image API, never directly from the
   internet.
3. Define supported input formats (jpeg, png, webp, avif, gif, heic-input-
   only-if-needed) and supported output formats explicitly; reject
   unsupported formats with a specific error at upload validation (P2-02),
   not at transformation time.

**Definition of Done**
- [ ] `docs/IMAGE-PROCESSING/01-SUPPORTED-FORMATS.md` is Final, and the
      supported-format list is enforced by the same validation code used in
      `P2-02`, not duplicated logic that can drift.

---

### P3-02: Transformation parameter parsing & normalization

- **Depends on:** P3-01
- **Implements:** `docs/API/13-IMAGE-TRANSFORMATION-API.md`, `docs/PLAN/12-IMAGE-QUERY-SPECIFICATION.md`, `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md`, `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md`

**Steps**
1. Build a single parameter parser shared by every entry point (query
   string today, path-segment form later if offered): parse, validate
   ranges (e.g. `quality` 1-100, `width`/`height` within platform max),
   apply defaults, and produce the canonical normalized parameter object
   that both the processor and `P2-01`'s `params_hash` consume.
2. Reject unknown parameters explicitly (`400`, not silently ignored) so
   client typos surface immediately instead of silently returning an
   unexpected image.
3. Unit test every parameter's accepted values, rejected values, and
   default.

**Definition of Done**
- [ ] `docs/API/13-IMAGE-TRANSFORMATION-API.md` is Final: every parameter,
      its accepted values, default, and interaction with every other
      parameter is written down, not left implicit in code.

---

### P3-03: Resize, fit modes & position/gravity

- **Depends on:** P3-02
- **Implements:** `docs/IMAGE-PROCESSING/03-IMAGE-RESIZE.md`, `04-IMAGE-CROP.md`, `05-IMAGE-FIT-MODES.md`, `06-IMAGE-POSITION.md`, `docs/IMAGE-DELIVERY-PROTOCOL/05-RESIZE-PROTOCOL.md`, `06-CROP-PROTOCOL.md`, `07-FIT-PROTOCOL.md`, `08-POSITION-PROTOCOL.md`, `10-ASPECT-RATIO-PROTOCOL.md`

**Steps**
1. Implement `fit=cover|contain|fill|scale-down` exactly as specified;
   `contain` with an explicit `background` param for letterboxing.
2. Implement named `position` values (center + 4 edges + 4 corners).
3. Build a golden-image test suite: known input + known params -> expected
   output dimensions and a perceptual-hash or checksum comparison against a
   committed reference image, so a future regression is caught
   automatically rather than by eyeballing.

**Definition of Done**
- [ ] Golden-image test suite covers every `fit` x every named `position`
      combination and is wired into CI (`docs/TESTING/04-IMAGE-TRANSFORMATION-TESTING.md`).

---

### P3-04: Focal point & auto-crop

- **Depends on:** P3-03
- **Implements:** `docs/IMAGE-PROCESSING/07-FOCAL-POINT.md`, `08-AUTO-CROP.md`, `docs/IMAGE-DELIVERY-PROTOCOL/09-FOCAL-POINT-PROTOCOL.md`

**Steps**
1. Add a per-asset-version `focal_point` (normalized x/y) column and API to
   set it manually (`PATCH /v1/assets/:id/focal-point`).
2. `position=face` (or `position=auto`) triggers detection (a lightweight
   saliency or face-detection library) at eager-processing time, cached on
   the asset version, with a documented, tested fallback to center-crop
   when detection has low confidence or fails.
3. Detection is explicitly **best-effort**: a detection-library outage must
   degrade to center-crop, never fail the request.

**Definition of Done**
- [ ] Killing/mocking the detection dependency still returns a valid
      (center-cropped) image, tested.

---

### P3-05: Quality, format conversion & format=auto negotiation

- **Depends on:** P3-02
- **Implements:** `docs/IMAGE-PROCESSING/09-QUALITY-CONTROL.md`, `10-FORMAT-CONVERSION.md`, `docs/API/13-IMAGE-TRANSFORMATION-API.md`, `docs/IMAGE-DELIVERY-PROTOCOL/11-QUALITY-PROTOCOL.md`, `12-FORMAT-NEGOTIATION.md`

**Steps**
1. Implement `quality=1..100` per format; document the platform default
   when omitted (recommend 80).
2. Implement `format=auto`: parse `Accept`, prefer AVIF > WebP > JPEG,
   always overridable by an explicit `format=` param.
3. Implement transparency handling on conversion: preserve alpha into
   WebP/PNG/AVIF, flatten onto `background` (default white, overridable)
   when converting to JPEG.

**Definition of Done**
- [ ] A request with `Accept: image/avif,image/webp,*/*` and no explicit
      `format` returns AVIF; with only `image/jpeg` accepted, returns JPEG
      -- both asserted by test.

---

### P3-06: Optimization, metadata stripping & orientation

- **Depends on:** P3-05
- **Implements:** `docs/IMAGE-PROCESSING/11-IMAGE-OPTIMIZATION.md`, `12-METADATA-EXIF.md`, `13-ORIENTATION.md`, `14-COLOR-PROFILE.md`

**Steps**
1. Always read and apply EXIF orientation before any other transform, then
   strip the orientation tag from output.
2. Strip EXIF/IPTC/XMP by default; add an opt-in `keep_metadata=true` param
   for the (rare) consumer that needs it.
3. Convert to sRGB by default; add opt-in profile preservation.
4. Apply lossless-safe defaults: progressive JPEG, appropriate chroma
   subsampling.

**Definition of Done**
- [ ] A rotated (EXIF-orientation-tagged) test image renders upright with
      no orientation tag in the output, verified by test.

---

### P3-07: Thumbnail presets & eager vs. lazy generation

- **Depends on:** P3-03, P3-05
- **Implements:** `docs/IMAGE-PROCESSING/15-THUMBNAIL-GENERATION.md`

**Steps**
1. Define the default preset(s) generated eagerly right after upload
   validation succeeds (e.g. one small thumbnail, used by the dashboard's
   asset manager grid).
2. Everything else is generated lazily on first request and cached (Phase
   4) -- document why (storage/compute cost of eagerly generating every
   possible derivative is unbounded, since derivatives are parameterized by
   an effectively infinite query space).

**Definition of Done**
- [ ] Asset status flips `processing -> ready` only once required eager
      derivatives (if any) finish, tested against the state machine in
      `docs/PLAN/07-IMAGE-LIFECYCLE.md`.

---

### P3-08: Processing failure handling & the image-delivery-API path

- **Depends on:** P3-01..P3-07
- **Implements:** `docs/IMAGE-PROCESSING/16-PROCESSING-FAILURE.md`, `docs/API/14-IMAGE-DELIVERY-API.md`, `docs/API/15-IMAGE-QUERY-API.md`, `docs/IMAGE-DELIVERY-PROTOCOL/24-ERROR-AND-FALLBACK.md`, `26-CONTENT-TYPE-RULES.md`

**Steps**
1. Wire `GET /v1/images/:assetId` (and/or the CDN-facing short path
   `GET /:assetId` reserved for Phase 4) end to end: fetch original via
   `StorageAdapter`, parse params (`P3-02`), transform (`P3-03`-`P3-06`),
   return bytes with correct `Content-Type`.
2. Define and implement the failure taxonomy: corrupt/unreadable source,
   unsupported requested format, processing timeout, engine crash -- each
   with a specific `error.code` and HTTP status, never a bare `500`.
3. Fire `processing.failed` (queued for Phase 6 webhook delivery) on
   terminal failure.

**Definition of Done**
- [ ] `docs/API/14-IMAGE-DELIVERY-API.md` and `15-IMAGE-QUERY-API.md` are
      Final; a full request-to-bytes integration test exists per
      `docs/TESTING/05-IMAGE-DELIVERY-TESTING.md`.

---

### P3-09: Processing queue, concurrency limits & worker scaling

- **Depends on:** P3-08
- **Implements:** `docs/ARCHITECTURE/12-QUEUE-WORKER-ARCHITECTURE.md`, `docs/PERFORMANCE/07-CONCURRENCY.md`

**Steps**
1. Route processing work through a queue (not inline in the API request
   for any path expected to be slow, e.g. large-image or cold/lazy
   derivatives); keep small/fast requests synchronous if latency requires
   it, but bound worst-case request time either way.
2. Define per-worker concurrency limits and backpressure behavior once the
   queue depth crosses a threshold (reject new heavy work with `503` +
   `Retry-After` rather than degrading every in-flight request).

**Definition of Done**
- [ ] A load test (stub acceptable here, full version in Phase 7) proves
      the API tier stays responsive to `/healthz` while the processing
      queue is saturated.

---

---

### P3-10: Canonical URL & transformation-pipeline contract

- **Depends on:** P3-02
- **Implements:** `docs/IMAGE-DELIVERY-PROTOCOL/00-PROTOCOL-OVERVIEW.md`, `01-DESIGN-PRINCIPLES.md`, `02-ASSET-URL-SPECIFICATION.md`, `16-TRANSFORMATION-PIPELINE.md`, `17-DERIVATIVE-IDENTITY.md`

This task exists because the Image Delivery Protocol is the platform's
primary contract, on equal footing with `docs/API/`, and deserves its own
formalization pass distinct from wiring individual parameters (`P3-02`
through `P3-06`).

**Steps**
1. Write `02-ASSET-URL-SPECIFICATION.md` to Final: the exact base path
   (`/v1/assets/{asset_id}`), what a malformed/unknown ID returns, and how
   a custom delivery domain resolves to a tenant (cross-reference
   `docs/MULTI-TENANCY/06-CDN-ISOLATION.md`).
2. Write `16-TRANSFORMATION-PIPELINE.md` to Final as a literal contract:
   Orientation -> Crop -> Resize -> Position/Focal Point -> Quality ->
   Format Conversion -> Metadata Strip -> Encode. Assert (via a code
   comment or a runtime assertion in debug builds) that the actual
   processing code in `P3-03`-`P3-06` executes in this exact order.
3. Write `17-DERIVATIVE-IDENTITY.md` to Final: confirm
   `derivative_id = hash(asset_version, canonical_params)` matches the
   `params_hash` built in `P2-01` byte-for-byte -- they must be the same
   value, not two independently-computed hashes that happen to agree today.
4. Write `00-PROTOCOL-OVERVIEW.md` and `01-DESIGN-PRINCIPLES.md` last, once
   the above are settled, as the one-page map/rulebook for the other 38
   documents in the category.

**Definition of Done**
- [ ] `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`'s hash
      algorithm and `docs/STORAGE/04-OBJECT-NAMING.md`'s `params_hash` are
      verified, by a shared unit test, to be the literal same function --
      not merely "equivalent in practice".

---
