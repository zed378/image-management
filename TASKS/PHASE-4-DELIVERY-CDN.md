# Phase 4 -- Delivery, CDN & Caching

Goal: derivatives generated in Phase 3 get served from the edge, not
regenerated per request; cache keys are correct and collision-free across
tenants; invalidation actually invalidates.

Exit criteria: repeat requests for the same derivative are a CDN cache hit
(verified via response headers/metrics); a new asset version or an explicit
purge invalidates exactly the right cache entries and nothing else; signed
URLs work through the CDN layer, not just at origin.

---

### P4-01: CDN selection & edge topology

- **Depends on:** P3-08
- **Implements:** `docs/ARCHITECTURE/10-CDN-ARCHITECTURE.md`, `docs/CDN/00-CDN-ARCHITECTURE.md`, `docs/CDN/05-EDGE-DELIVERY.md`, `docs/IMAGE-DELIVERY-PROTOCOL/20-CDN-DELIVERY-PROTOCOL.md`

**Steps**
1. Select the CDN provider (record the decision and alternatives in
   `MEMORY/DECISIONS.md`) and configure it to front the Image Delivery API
   as origin, with origin shielding to one region so cold-cache fan-out
   doesn't stampede origin.
2. Configure per-tenant/custom-domain support if `docs/PLAN/17-PRICING-ENTITLEMENT.md`
   entitles it at any plan tier (CNAME onto the platform's edge).

**Definition of Done**
- [ ] `docs/CDN/00-CDN-ARCHITECTURE.md` is Final with the actual provider,
      topology diagram, and origin-shield configuration.

---

### P4-02: Cache key strategy

- **Depends on:** P4-01, P3-02
- **Implements:** `docs/CDN/01-CACHE-KEY.md`, `docs/PLAN/13-CACHING-STRATEGY.md`, `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`

**Steps**
1. Define the CDN cache key as the canonical normalized parameter set from
   `P3-02` (the same normalization used for `params_hash`), explicitly
   including `tenant_id`/`project_id`/`asset_id` -- **the cache key must
   make cross-tenant collision structurally impossible**, not merely
   unlikely.
2. Strip cache-irrelevant query params (tracking params, etc.) from the
   key, or reject them outright at the API layer, so they don't fragment
   the cache.
3. Add an automated test asserting two different tenants' identical
   transformation requests never share a cache key even if every other
   parameter is byte-identical.

**Definition of Done**
- [ ] The cross-tenant cache-key collision test from step 3 exists and
      passes, and is added to the `P1-06` isolation-test CI gate.

---

### P4-03: Cache-Control headers & TTL policy

- **Depends on:** P4-02
- **Implements:** `docs/CDN/02-CACHE-CONTROL.md`, `docs/CDN/04-CACHE-TTL.md`, `docs/IMAGE-DELIVERY-PROTOCOL/19-CACHE-CONTROL.md`, `27-HTTP-CACHING.md`, `29-ETAG-AND-CONDITIONAL-REQUESTS.md`

**Steps**
1. Set `Cache-Control` (public/private per visibility, `max-age`,
   `immutable` where the URL is content-addressed) and `ETag` on every
   delivery response.
2. Define TTL per asset visibility class from `docs/PLAN/21-ASSET-VISIBILITY.md`:
   PUBLIC assets cache long; SIGNED/EXPIRING assets cache only up to their
   own expiry, never past it.

**Definition of Done**
- [ ] A signed URL with a 5-minute expiry never produces a CDN cache entry
      with a longer TTL than the signature's own expiry, tested.

---

### P4-04: Cache invalidation

- **Depends on:** P4-02
- **Implements:** `docs/CDN/03-CACHE-INVALIDATION.md`

**Steps**
1. Wire the invalidation call stubbed in `P2-05` (version promotion) to
   actually purge: either a provider purge-by-tag/prefix API, or rely on
   content-addressed cache keys plus TTL expiry (document which strategy is
   chosen and why -- purge APIs are simpler to reason about but often
   rate-limited; content-addressing avoids purges entirely at the cost of
   stale-URL cleanup).
2. Wire invalidation into: asset hard-delete, visibility change
   (public -> private must stop serving from cache immediately), and
   version promotion.

**Definition of Done**
- [ ] Changing an asset's visibility from PUBLIC to PRIVATE results in the
      CDN refusing (or origin refusing) the previously-public URL within
      the platform's stated SLA for that operation, tested against a real
      or realistic CDN sandbox.

---

### P4-05: Bandwidth optimization & CDN failover

- **Depends on:** P4-03
- **Implements:** `docs/CDN/07-BANDWIDTH-OPTIMIZATION.md`, `docs/CDN/08-CDN-FAILOVER.md`, `docs/CDN/06-SIGNED-URL-CACHE.md`, `docs/IMAGE-DELIVERY-PROTOCOL/13-DPR-AND-RESPONSIVE-IMAGES.md`

**Steps**
1. Confirm `format=auto` (P3-05) plus the TTL policy together are measured
   and reported in `docs/OBSERVABILITY/06-CDN-METRICS.md` as bandwidth
   savings.
2. Define and, if the chosen provider supports it, configure
   stale-while-revalidate / stale-if-error behavior for origin outages.
3. Confirm signed-URL requests are still cacheable at the edge when the
   signature (not the resource) is what varies -- document the tradeoff if
   the chosen scheme makes them effectively uncacheable.

**Definition of Done**
- [ ] `docs/CDN/08-CDN-FAILOVER.md` states, concretely, what a client
      receives during an origin outage (stale-but-valid image vs. an
      explicit error) -- not left unspecified.

---

### P4-06: Delivery-path load & correctness testing

- **Depends on:** P4-01..P4-05
- **Implements:** `docs/TESTING/07-CDN-TESTING.md`, `docs/PERFORMANCE/04-CDN-PERFORMANCE.md`

**Steps**
1. Automated test: same request twice, second is a cache hit (header
   assertion).
2. Automated test: two tenants' identical-looking requests never
   cross-serve (repeat of `P4-02`'s test at the CDN layer, not just
   origin's key-generation layer, since a CDN misconfiguration could
   reintroduce the bug at a layer origin-level tests can't see).
3. Record baseline delivery latency (p50/p95/p99, warm and cold cache)
   against the targets set in `docs/PERFORMANCE/00-PERFORMANCE-REQUIREMENTS.md`.

**Definition of Done**
- [ ] Baseline numbers are recorded in `MEMORY/records/P4-06.md` for future
      regression comparison in Phase 7.

---

---

### P4-07: HTTP delivery semantics -- HEAD, conditional & range requests

- **Depends on:** P3-08, P4-03
- **Implements:** `docs/IMAGE-DELIVERY-PROTOCOL/25-IMAGE-HEAD-REQUEST.md`, `26-CONTENT-TYPE-RULES.md`, `28-RANGE-REQUESTS.md`, `29-ETAG-AND-CONDITIONAL-REQUESTS.md`, `13-DPR-AND-RESPONSIVE-IMAGES.md`, `15-IMAGE-NEGOTIATION.md`

**Steps**
1. Implement `HEAD` support that runs the exact same validation and
   authorization path as `GET` (no shortcut that could leak existence or
   bypass a signature check), returning headers only.
2. Implement `ETag` generation from `derivative_id` (per
   `17-DERIVATIVE-IDENTITY.md`) and `If-None-Match`/`If-Modified-Since`
   conditional handling, returning `304` with authorization still
   re-checked on every request.
3. Decide and implement (or explicitly defer, per
   `28-RANGE-REQUESTS.md`'s own guidance) `Range` request support.
4. Implement `dpr=` handling (`13-DPR-AND-RESPONSIVE-IMAGES.md`) and, if
   in v1 scope, `Save-Data`-aware negotiation (`15-IMAGE-NEGOTIATION.md`).

**Definition of Done**
- [ ] A `HEAD` request against a PRIVATE asset with an invalid/missing
      signature is rejected identically to how a `GET` would be, tested.
- [ ] `26-CONTENT-TYPE-RULES.md` is Final and its mapping is asserted by
      test for every supported output format, including negotiated `auto`.

---

### P4-08: Protocol conformance test suite & reference examples

- **Depends on:** P3-10, P4-02, P4-07
- **Implements:** `docs/IMAGE-DELIVERY-PROTOCOL/37-PROTOCOL-TESTING.md`, `38-REFERENCE-IMPLEMENTATION.md`, `39-PROTOCOL-EXAMPLES.md`, `30-VERSIONING.md`, `31-COMPATIBILITY.md`, `32-SECURITY-CONSTRAINTS.md`

**Steps**
1. Build the fixed conformance corpus: a small set of reference source
   images paired with parameter sets covering every `fit`/`position`/
   `focus`/`format` combination, each with an expected output
   dimension/format and a perceptual-hash or checksum tolerance.
2. Wire this corpus into CI as the gate any future image-engine swap (per
   `MEMORY/DECISIONS.md` ADR on the processing engine) must pass before
   being merged.
3. Write `39-PROTOCOL-EXAMPLES.md` as the fast-path consumer document:
   plain thumbnail, focal-point crop, `format=auto`, a responsive `srcset`
   block, and a signed private-image URL, each a real, runnable example
   against the actual deployed API, not pseudocode.
4. Finalize `30-VERSIONING.md`/`31-COMPATIBILITY.md` against what `v1`
   actually shipped as of this task, and `32-SECURITY-CONSTRAINTS.md`
   against the hard parameter bounds implemented in `P3-02`.

**Definition of Done**
- [ ] The conformance suite is a named, required CI job, referenced by
      `docs/TESTING/04-IMAGE-TRANSFORMATION-TESTING.md`.
- [ ] `docs/IMAGE-DELIVERY-PROTOCOL/README.md`'s 40 documents are all
      Final; any still-open item is explicitly logged in
      `docs/PLAN/20-RISK-REGISTER.md`, not left silently Draft.

---
