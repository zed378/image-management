# Decisions (ADR Log)

One entry per non-obvious decision. Newest at the bottom. Superseded
entries stay, marked as such -- never delete history.

Format:

```
### ADR-NNN: <decision>
- Status: Accepted | Superseded by ADR-NNN | Rejected
- Date: <when decided>
- Context: <what problem forced a choice>
- Decision: <what was chosen>
- Alternatives considered: <what else, and why not>
- Consequences: <what this makes easier/harder later>
```

The entries below are the decisions already implied by `docs/` and
`TASKS/` at the specification stage -- recorded here so implementation
starts from an agreed baseline instead of re-litigating them. Add new ADRs
below the last one as real tasks are executed and real forks in the road
are hit.

---

### ADR-001: Storage is abstracted behind an internal adapter interface
- Status: Accepted
- Context: The platform's core value proposition is that consumer
  applications never know or care what object storage backend sits
  underneath (`docs/STORAGE/01-STORAGE-ABSTRACTION.md`).
- Decision: Define a `StorageAdapter` interface (`put`, `get`, `delete`,
  `exists`, `presignPut`, `presignGet`, `list`) in `packages/storage-adapter`;
  no other package may import a provider SDK directly.
- Alternatives considered: Coupling directly to one provider's SDK
  (S3) for v1 speed, generalizing later -- rejected because the whole
  product pitch is "storage can be swapped without a consumer-facing
  change," and that claim is only true if it's true from day one, not
  retrofitted.
- Consequences: Every new provider is an adapter implementation plus a
  pass of the shared conformance test suite (`TASKS/PHASE-0-FOUNDATION.md`
  P0-07), not a rewrite.

### ADR-002: S3-compatible API as the v1 storage baseline
- Status: Superseded by ADR-021 (local disk is now the default; S3 remains a supported provider)
- Context: S3, Cloudflare R2, and MinIO (local dev) all speak the same S3
  API; GCS and Azure Blob do not.
- Decision: Implement one S3-compatible adapter first, covering three
  providers with one implementation; treat GCS/Azure Blob adapters as
  later, separately-scheduled work, not a v1 blocker.
- Alternatives considered: A universal storage library that already wraps
  multiple providers -- rejected to avoid an early, hard-to-audit
  dependency on the correctness of someone else's abstraction for a
  security-relevant path (presigned URLs).
- Consequences: Local dev (MinIO) and much of production (S3/R2) share one
  code path, reducing "works locally, breaks in prod" storage bugs.

### ADR-003: ULIDs as the primary key strategy
- Status: Accepted
- Context: Need primary keys that are sortable (for pagination without a
  separate index), URL-safe, and generatable without central coordination.
- Decision: Use ULIDs for `assets`, `asset_versions`, and other
  user-facing resource IDs.
- Alternatives considered: Auto-increment integers (leak resource count
  and are easily enumerable -- a direct IDOR-adjacent risk); UUIDv4
  (not sortable, hurts index locality for time-ordered queries).
- Consequences: IDs are non-enumerable by default, which helps but does
  **not** replace the explicit authorization check every `:id` endpoint
  still requires (`docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`).

### ADR-004: Cache key and object key both derive from one canonical
    parameter normalization function
- Status: Accepted
- Context: `/image/abc?w=400&h=300` and `?h=300&w=400` must be the same
  derivative; a naive raw-query-string cache key would treat them as
  different and double-generate/double-store.
- Decision: One shared "normalize transformation params" function (sort
  keys, resolve aliases, coerce types) feeds both the CDN cache key
  (`docs/CDN/01-CACHE-KEY.md`) and the derivative's storage object key
  (`docs/STORAGE/04-OBJECT-NAMING.md`) via a single `params_hash`.
- Alternatives considered: Separate normalization logic per layer --
  rejected, drift between the two would silently create duplicate storage
  objects for what should be one derivative.
- Consequences: `params_hash` becomes a load-bearing, cross-cutting
  function; changing its algorithm after launch invalidates every existing
  cache/storage key and must itself go through an ADR before it happens.

### ADR-005: Tenant isolation enforced at the query layer, not only the
    API layer
- Status: Accepted
- Context: An authorization check at the API/controller layer alone is one
  bug away from a cross-tenant leak if any query anywhere forgets to apply
  it.
- Decision: A base repository layer injects `tenant_id`/`project_id`
  scoping into every query by construction; combined with (not instead of)
  an API-layer authorization check, per `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`.
- Alternatives considered: Postgres row-level security (RLS) as the sole
  mechanism -- kept as a candidate defense-in-depth addition, not adopted
  as the *only* mechanism, since RLS misconfiguration is itself a common
  real-world source of cross-tenant leaks and the team wants an
  application-layer guarantee that doesn't depend on DB session variables
  being set correctly on every connection.
- Consequences: New tables/queries must go through the base repository;
  a raw-query bypass is a code-review-blocking finding, not a style nit.

### ADR-006: Signed URLs use HMAC-SHA256 over a canonical request string
- Status: Accepted
- Context: Private/expiring assets need a verifiable, forgery-resistant
  URL scheme that multiple SDKs (TypeScript, PHP, Go) can independently
  implement and produce byte-identical signatures for.
- Decision: HMAC-SHA256 over `method + path + sorted(params) + expiry`,
  per-application secret, constant-time verification
  (`docs/SECURITY/12-SIGNED-URL.md`).
- Alternatives considered: JWT-based signed URLs -- rejected as
  unnecessarily heavy (larger URLs, a full claims/verification library) for
  a scheme that only needs "this exact request, until this exact time."
- Consequences: Every SDK ships a cross-language test-vector suite
  (`TASKS/PHASE-6...` P6-06) to prove compatibility.

### ADR-007: Webhook and processing work run through a queue, never
    inline on the request path
- Status: Accepted
- Context: Image processing and third-party webhook delivery are both
  operations with unpredictable, sometimes-long latency and third-party
  failure modes; neither should be able to slow down or fail an unrelated
  API request.
- Decision: Both go through Redis-backed queues consumed by dedicated
  worker processes (`docs/ARCHITECTURE/12-QUEUE-WORKER-ARCHITECTURE.md`).
- Alternatives considered: Synchronous processing for "small" images to
  save the queueing overhead -- left as an optional later optimization,
  not the default, since "small" is a moving target and the failure-mode
  argument (a receiver's webhook endpoint being down) applies regardless
  of payload size.
- Consequences: The API tier's latency profile is decoupled from
  processing/delivery latency; requires the sweeper/dead-letter handling
  built in `TASKS/PHASE-6...` P6-04.

### ADR-008: `format=auto` prefers AVIF, then WebP, then JPEG
- Status: Accepted (qualified by ADR-016 -- the preference stands, with a
  size guard; the encode-cost caveat below was measured and did not hold)
- Context: Bandwidth optimization is a core platform value; format choice
  is the single biggest lever, more so than quality tuning.
- Decision: When `format` is omitted or explicitly `auto`, negotiate off
  the `Accept` header in that priority order; an explicit `format=`
  parameter always overrides.
- Alternatives considered: WebP-only auto-negotiation (broader legacy
  client support) -- rejected as the default since AVIF's compression
  advantage is large enough to prefer it wherever the client already
  advertises support, with WebP as the still-strong fallback.
- Consequences: Requires format-support detection to be re-verified
  periodically as client support shifts; revisit this ADR if AVIF encode
  cost becomes a measured processing-time bottleneck in `P7-05`'s load
  tests.
- **Outcome of that caveat (2026-09-18):** measured in
  `docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md`. AVIF encode cost is
  *not* a bottleneck at `effort: 1` -- it is cheaper than both JPEG and WebP
  on photographic content. The caveat pointed at the wrong variable: encoder
  *effort* is the cost lever, not codec choice. A separate problem did
  surface, that AVIF is larger than JPEG on high-frequency content, so the
  preference now carries a size guard. See `ADR-016`.

### ADR-009: Image Delivery Protocol is a first-class documentation
    category, on equal footing with API/
- Status: Accepted
- Date: added after initial repository generation
- Context: `docs/API/13-IMAGE-TRANSFORMATION-API.md` alone conflated two
  different concerns: how a consumer *manages* an asset (CRUD, upload,
  metadata -- genuinely an API-management concern) and how a consumer
  *consumes* an asset (URL format, transformation parameters, pipeline
  order, cache-key derivation, HTTP delivery semantics -- a wire protocol
  that a CDN edge, a browser cache, and multiple SDKs all need to
  independently implement or verify against). Folding the second concern
  as a sub-page of `API/` under-signaled its importance and made it easy
  for `docs/CDN/` and `docs/STORAGE/`'s cache/object-key logic to drift
  from the API layer's parameter definitions.
- Decision: Introduce `docs/IMAGE-DELIVERY-PROTOCOL/` (40 documents,
  `00`-`39`) as its own top-level category, explicitly positioned as the
  platform's primary contract alongside `API/`. `API/13-IMAGE-TRANSFORMATION-API.md`
  now defers to this category as the normative source for parameter
  semantics rather than redefining them. The category owns: canonical URL
  format (`02`), formal query-string canonicalization (`03`-`04`), the
  fixed transformation pipeline order (`16`), derivative identity (`17`),
  the cache-key algorithm (`18`), signed-URL protocol framing (`21`-`23`),
  and HTTP-level delivery semantics (`25`-`29`).
- Alternatives considered: Keeping everything under `API/` with more
  sub-documents -- rejected because it obscures that this is a protocol
  multiple independent implementations (origin, CDN edge, every SDK) must
  agree on byte-for-byte, not just an internal API detail; treating it as
  part of `IMAGE-PROCESSING/` -- rejected because the protocol governs
  *delivery* semantics (URLs, caching, HTTP) as much as *processing*
  semantics, and conflating the two would re-create the exact
  wire-vs-implementation confusion `ADR-004`'s shared `params_hash`
  function was designed to avoid.
- Consequences: `docs/STORAGE/04-OBJECT-NAMING.md`'s `params_hash`,
  `docs/CDN/01-CACHE-KEY.md`'s cache key, and
  `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`'s
  `derivative_id` are now explicitly required (`TASKS/PHASE-3...` P3-10) to
  be the *same* computed value, not three independently-implemented
  functions that happen to agree today. `TASKS/PHASE-3-PROCESSING-TRANSFORMATION.md`
  and `PHASE-4-DELIVERY-CDN.md` were updated to reference this category
  directly in their `Implements:` lists, and gained two new tasks (`P3-10`,
  `P4-07`, `P4-08`) to formalize and conformance-test it explicitly.

### ADR-010: Engineering conventions are a first-class `docs/` category
- Status: Accepted
- Date: 2026-09-18
- Context: 74 tasks across 8 phases will be executed by different people and
  different agent sessions, none of which remember the others. Almost every
  task touches a `docs/` file, application code, and a test suite in one
  change. Without a written, specific convention, each session invents its
  own file layout, error shape, naming, and tenant-scoping idiom, and the
  result is one codebase in eight dialects -- with the dialects differing
  most at exactly the boundaries (`params_hash`, tenant scoping, signed
  URLs) where `MEMORY/DECISIONS.md` already recorded a decision that only
  holds if it is implemented one way. `AGENTS.md`'s "Recommended default
  stack" named the technologies but not how to use them.
- Decision: Introduce `docs/ENGINEERING/` (16 documents) as its own
  top-level category, with `00-CODING-CONTEXT.md` as a one-page master
  reference read at the start of every session and `01-CODING-STANDARDS.md`
  as the detailed, numbered standard. `AGENTS.md`'s session loop now names
  reading `00-CODING-CONTEXT.md` as an explicit step, and its Hard rules
  section names deviation from this category as an ADR rather than a
  judgment call.
- Alternatives considered: (a) Two root-level files (`CODING_STANDARDS.md`,
  `CODING_CONTEXT.md`) as in the reference repository this was modelled on
  -- rejected because every other body of specification in this project
  lives in a numbered `docs/` category with a `README.md`, and a
  root-level exception would be the one document nobody maintains alongside
  the rest. (b) Folding the rules into `AGENTS.md` -- rejected because
  `AGENTS.md` is deliberately short and about *process*; a 1,200-line
  coding standard inside it would bury the eight-step loop that matters
  most. (c) Distributing the rules into the categories they relate to
  (error handling into `docs/API/`, scoping into `docs/MULTI-TENANCY/`) --
  rejected because those categories specify the *contract* and must stay
  implementation-neutral; an SDK author reading `docs/API/` should not have
  to skip our ESLint configuration.
- Consequences: One more category to keep current, and a genuine
  bidirectional obligation: when `P0-06` picks a query layer, `P0-08` picks
  an HTTP framework, and `P0-09` ratifies the error envelope, the
  corresponding `docs/ENGINEERING/` documents are updated in the same
  change -- each one names which task owns which open question in its own
  "Open Questions" section, so this is checkable rather than hoped for. In
  exchange, the architectural invariants from ADR-001, ADR-004, and ADR-005
  become lint rules and CI gates (`docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md`)
  instead of things a reviewer must remember.

### ADR-011: Code-level conventions baseline (layering, `ctx`-first, Zod, wire casing)
- Status: Accepted
- Date: 2026-09-18
- Context: `docs/ENGINEERING/` is only useful if it makes specific choices.
  Four of them were genuine forks that would otherwise be re-litigated per
  task, and three of them are load-bearing for existing ADRs.
- Decision:
  1. **Module-per-domain vertical slices**
     (`asset.routes.ts`/`.controller.ts`/`.service.ts`/`.repository.ts`)
     rather than layer-first directories, with a fixed one-way call chain
     `routes -> controller -> service -> repository -> packages/db`,
     enforced by `no-restricted-imports` on filename globs and by
     `dependency-cruiser`.
  2. **`ctx: TenantContext` is the first positional parameter of every
     repository and service function.** This is how ADR-005 is enforced at
     compile time rather than by discipline: a forgotten tenant scope
     becomes a type error, not a cross-tenant read. Deliberately chosen over
     `AsyncLocalStorage`, which would make the same code read correctly
     while depending on invisible ambient state that a worker, a test, or a
     cron job can silently fail to establish.
  3. **Zod as the single source of runtime validation and the TypeScript
     type** at every boundary (HTTP request, job payload, config, cached
     value). One schema, one inferred type, no hand-written duplicate that
     can drift.
  4. **`snake_case` on the wire, `camelCase` in TypeScript, converted only
     in `*.mapper.ts`.** The database, the delivery protocol, and the API
     then name the same concept with the same string (`params_hash`,
     `content_type`), which makes a field greppable across a SQL query, a
     log line, a cache-key debug header, and a JSON response.
- Alternatives considered: Layer-first directories (rejected: every task
  touches one concept across all layers, so a layer-first tree makes each
  task a four-directory diff); `AsyncLocalStorage` for tenant context
  (rejected as above -- it optimizes for terse signatures at the cost of the
  one guarantee ADR-005 exists to provide); a service-layer result object
  `{ success, status, message, data }` as in the repository this convention
  was modelled on (rejected: a status code in a return value makes a service
  unusable from a worker, and this platform runs half its work in workers --
  so services throw typed `AppError`s and only the HTTP error middleware
  knows about status codes); `camelCase` on the wire (rejected for the
  greppability argument above, though `docs/API/01-API-STANDARDS.md` remains
  the normative home and `P0-09` may overrule it).
- Consequences: The `ctx`-first rule makes every repository signature two
  characters longer and makes ADR-005 mechanically checkable, which is the
  trade this platform wants. `scoped()`'s six required properties
  (`docs/ENGINEERING/07-REPOSITORY-DATABASE-STANDARDS.md`) become the
  selection criteria for `P0-06`'s query layer: an ORM that cannot express
  a tenant predicate a caller is unable to remove makes ADR-005
  unenforceable and should lose on that basis alone. The wire-casing choice
  is the one item here that `P0-09` may reverse; if it does, this document
  and every `*.schema.ts` change together, not separately.

### ADR-012: Transformation parameter vocabulary follows real standards
    first, then the cross-provider consensus
- Status: Accepted
- Date: 2026-09-18
- Context: `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md`
  and `03-TRANSFORMATION-URL-SPECIFICATION.md` both carried the same open
  question -- *"Confirm parameter naming (`w` vs `width`, `q` vs
  `quality`)"* -- and nothing downstream could be finalized until it was
  answered. A survey of the four providers our consumers are most likely to
  arrive from (imgix, Cloudflare Images, Cloudinary, ImageKit, each checked
  against its official documentation on 2026-09-18) showed strong agreement
  on short names (`w`, `h`, `ar`, `q`, `f`, `dpr`, `bg`) and near-total
  disagreement on the `fit` value vocabulary: imgix uses
  `clip`/`crop`/`fill`/`max`/`min`/`scale`, Cloudflare uses
  `scale-down`/`contain`/`cover`/`crop`/`pad`/`squeeze`. Two of our earlier
  draft names were also idiosyncratic: `position` (sharp's own API name) and
  `ratio` (everyone else says `ar`).
- Decision: Two ordered rules. **(1) Where a real standard exists, follow
  the standard rather than any vendor.** `fit` takes the CSS `object-fit`
  vocabulary (`cover`, `contain`, `fill`, `scale-down`, `none`; CSS Images
  Module Level 3) plus two extra values (`inside`, `outside`) for the cases
  that change output dimensions, which CSS has no concept of. Content
  negotiation follows RFC 9110 `Accept`/`Vary`; the sizing parameters are
  designed to drop into WHATWG `srcset`/`sizes`. **(2) Where no standard
  exists, take the largest intersection across providers.** Canonical names
  are the short forms; long forms (`width`, `quality`, `format`,
  `background`) are accepted aliases because Cloudflare accepts both and
  they read better in hand-written URLs. `position` becomes `g` (canonical
  `g`/`gravity`, per Cloudflare and Cloudinary); `ratio` becomes `ar`.
  Defaults are stated explicitly, notably `fit=scale-down` -- chosen because
  it is the only non-destructive default (never crops, never upscales) and
  is deliberately not sharp's default of `cover`, so the engine default must
  be overridden in code and pinned by a test.
- Alternatives considered: (a) Adopt imgix's vocabulary wholesale, since our
  URL form is also query-string -- rejected because imgix's `fit` values are
  understood nowhere outside imgix, and `clip`/`min`/`max` are actively
  confusing. (b) Invent a clearer vocabulary of our own -- rejected: a
  protocol that an origin, a CDN edge, and several SDKs must agree on
  byte-for-byte gains nothing from novelty, and every original name is a
  name a migrating developer has to learn. (c) Keep `position` because the
  implementation uses it -- rejected as the same abstraction leak `ADR-001`
  forbids for storage; the public protocol must not inherit the processing
  library's vocabulary, or swapping the engine becomes a breaking API
  change.
- Consequences: A migrating consumer guesses our names correctly on the
  first try, which is the point. The alias map is *data* -- one table in
  `packages/transform-params` -- so imgix and Cloudinary compatibility modes
  (`fm=`, `auto=format`, `c=fill`, `fo=`) cost a row each rather than a code
  path, and that directly serves `docs/DEVELOPER/13-MIGRATION.md`. Because
  aliases resolve before hashing, they cannot fragment the cache. The
  `fit=scale-down` default is now a load-bearing published value: changing
  it later would alter the bytes returned by every existing URL that omits
  `fit`, making it a breaking change under
  `docs/IMAGE-DELIVERY-PROTOCOL/30-VERSIONING.md`.

### ADR-013: Unknown query parameters are partitioned, not blanket-rejected
- Status: Accepted
- Date: 2026-09-18
- Context: The draft of `03-TRANSFORMATION-URL-SPECIFICATION.md` specified
  `400` for any unrecognized parameter, on the sound reasoning that silently
  ignoring `widht=400` returns a different, wrong image without telling the
  developer. But every surveyed provider ignores unknown parameters instead,
  and the blanket rule has a concrete production failure mode we would not
  control: image URLs get shared, and shared URLs acquire tracking
  parameters. `?utm_source=`, `?fbclid=`, `?gclid=`, a proxy's own additions
  -- under a blanket `400` every one of those turns a working image into a
  broken one, caused by traffic the developer using our platform has no say
  over.
- Decision: Partition incoming parameters three ways. **Known** (canonical
  name or alias) are processed. **Near-miss** (edit distance <= 2 from a
  known name, or a known name in the wrong case) are rejected `400
  invalid_transform_param` naming the suspected intent -- this preserves the
  typo protection that motivated the strict rule, and typos are the case
  that actually bites developers. **Foreign** (everything else) are ignored,
  excluded from the cache key, and listed in an `X-Image-Ignored-Params`
  response header. A project may opt into `strict_parameters` to reject
  foreign parameters too; off by default.
- Alternatives considered: (a) Blanket reject, as drafted -- rejected for the
  shared-URL failure mode above. (b) Blanket ignore, as all four providers
  do -- rejected because it silently returns the wrong image for a typo, and
  the resulting support burden ("why is my crop not applying") is exactly
  what the response header solves for free. (c) Namespace every
  transformation parameter with a prefix so foreign ones are unambiguous --
  rejected as hostile to the consensus naming ADR-012 just adopted; no
  provider does it and every URL would get longer.
- Consequences: Foreign parameters can never fragment the cache, because
  they are dropped before canonicalization. The near-miss threshold (edit
  distance <= 2) is a guess that needs tuning in `P3-02` against the real
  vocabulary -- too tight misses typos, too loose rejects legitimate foreign
  parameters, and both directions need a test per known-name pair.
  `X-Image-Ignored-Params` is a header on a cacheable object, so whether it
  is emitted always or only under a debug flag interacts with the edge and
  is left to `P4-01`.

### ADR-014: Deferred (`auto`) parameter values resolve to concrete values
    before hashing; dimension snapping is opt-in
- Status: Accepted
- Date: 2026-09-18
- Context: Two related questions fell out of finalizing the parameter table.
  First, the protocol accepts several "decide this later" values -- `f=auto`,
  `q=auto`, `g=auto`, `g=face`, `rot=auto`. Second, `w` accepts arbitrary
  integers, which means one image can have effectively unbounded distinct
  derivatives, and derivative cardinality -- not request rate -- is this
  platform's real cost driver.
- Decision: **(1)** Every deferred value is resolved to a concrete value
  during canonicalization, and the concrete value enters `params_hash`,
  never the literal string `auto` (step 9 of the algorithm in `03`).
  Correspondingly, the raw `Accept` header never reaches a cache key: it
  collapses to exactly one of three buckets (`avif`, `webp`, `jpeg`) in
  `ADR-008`'s priority order, and the bucket is what `f=auto` resolves to.
  **(2)** `w`/`h` accept arbitrary integers by default, matching every
  surveyed provider except Next.js. A per-project setting snaps them up to
  the nearest rung of a discrete ladder, defaulting to Next.js's own width
  list (`16,32,48,64,96,128,256,384,640,750,828,1080,1200,1920,2048,3840`);
  when enabled, the snapped value is what enters `params_hash`.
- Alternatives considered: For (1), hashing `auto` literally -- rejected, and
  this is the important half of this ADR: retuning the quality table,
  changing the format ladder, or upgrading the saliency model would leave
  every cache entry and stored object keyed identically while the bytes they
  should contain had changed, so the edge would serve the stale encoding
  indefinitely with nothing in the system able to detect it. That is
  `ADR-004`'s failure mode one layer up. Also rejected: `Vary` on the raw
  `Accept` header -- real-world `Accept` values are numerous enough to
  fragment the edge cache badly for no benefit. For (2), snapping by default
  -- rejected because a developer who asks for 401px and receives 640px has
  hit a surprise, and surprise in a public protocol costs more trust than
  the snapping saves in cost.
- Consequences: Two requests for the same URL from clients with different
  `Accept` headers are legitimately two derivatives;
  `12-FORMAT-NEGOTIATION.md` and `18-CACHE-KEY-SPECIFICATION.md` must both
  treat the bucket, not the header, as the varying input. The quality table,
  the format ladder, the blur/sharpen sigma mapping, and the ladder rungs all
  become versioned tables: changing any of their values changes output for
  unchanged URLs, so each carries a version that participates in the hash.
  `g=auto`/`g=face` additionally need a stability guarantee across engine
  upgrades (open question in `04`, decided in `P3-06`) -- persisting the
  resolved rectangle with the derivative is the leading candidate. Snapping
  remains available as the single largest cost lever, and
  `docs/PLAN/17-PRICING-ENTITLEMENT.md` may expose it to customers as one.

### ADR-015: AVIF is never on the critical path -- `f=auto` degrades
    progressively, explicit `f=` never degrades
- Status: Accepted; **rationale replaced by ADR-016.** The mechanism below
  (progressive upgrade, `auto` may degrade / explicit never degrades, the
  identity and failure rules) stands unchanged and is normative. Its stated
  reason -- that AVIF encoding is too expensive for the request path -- was
  measured on the same day and proved false at low effort. Read `ADR-016`
  for why the mechanism is still needed: not for latency, but because the
  format size guard cannot run on the request path. Do not implement this
  ADR from the Context section below without reading `ADR-016` first.
- Date: 2026-09-18
- Context: `ADR-008` made `f=auto` prefer AVIF, then WebP, then JPEG, and
  noted its own exit condition: *"revisit this ADR if AVIF encode cost
  becomes a measured processing-time bottleneck."* AVIF encoding is the most
  expensive single operation in the pipeline by a wide margin, and on a cold
  derivative it sits directly on the request path, where the visitor waits
  for it. Worse, the cases that produce many cold derivatives at once -- a
  catalog import going live, a cache purge, a newly popular page -- produce
  bursts of simultaneous expensive encodes, so the worker fleet has to be
  sized for peak latency rather than average throughput.

  The obvious framing, "synchronous or asynchronous", turns out to be the
  wrong question. The delivery path is called by an `<img>` element, which
  needs bytes now; there is no `202 Accepted` available and no placeholder
  that is acceptable in a layout. Fully asynchronous is not an option the
  protocol can offer. The real question is **what is served while AVIF is
  not ready**.
- Decision: One asymmetry resolves it. **`f=auto` may degrade; an explicit
  `f=` never degrades.** `auto` delegates the format choice to the platform,
  so choosing a cheaper format when the preferred one is not yet available
  is a decision `auto` licenses -- provided it is specified, which
  `12-FORMAT-NEGOTIATION.md` now does. An explicit `f=avif` is a caller who
  knows what they want and has accepted the latency; it is generated
  synchronously at full effort or it fails, never substituted.

  Concretely, for a request where `f=auto` resolves to `avif`: if the AVIF
  derivative exists, serve it immutably. If it is absent, enqueue the
  full-effort AVIF job (single-flight on a deterministic
  `<assetVersionId>:<paramsHash>` job id), ensure the fallback derivative
  exists, and serve the fallback with `max-age=60,
  stale-while-revalidate=300` plus `X-Image-Format-Fallback: avif-pending`.
  The next request after the TTL lifts gets AVIF with the immutable TTL.
  The fallback format is the cheapest the client accepts -- WebP, or JPEG
  for the rare client advertising AVIF but not WebP.

  Three supporting rules, each of which the mechanism is incorrect without:
  **(a)** the fallback bytes are stored under the *WebP* derivative's own
  object key, never under the AVIF key -- only the edge's cached response is
  short-lived, never a stored object; the request's `params_hash` is
  unaffected. **(b)** An AVIF job that fails unretryably marks the
  derivative `avif_unavailable`, and the fallback then becomes the final
  answer served with the full immutable TTL. **(c)** On repeated pending
  misses the fallback TTL backs off 60s -> 300s -> 1800s.
- Alternatives considered: (a) **Keep AVIF fully synchronous.** Simplest, one
  code path, no eventual consistency -- rejected because it puts the most
  expensive operation in the system on the path a visitor waits on, and
  forces fleet sizing for burst. (b) **Serve a low-effort AVIF immediately
  and re-encode at full effort in the background.** Superficially elegant,
  and rejected on a specific technical ground: it produces two different
  byte streams for the same `params_hash` in the same format, so they cannot
  be distinguished by key, which makes the derivative-identity model
  incoherent for a marginal latency gain. Encoder effort is an internal
  tuning parameter and must not become part of a URL's identity. (c) **Serve
  a redirect to the original, or the original resized in place.** Wrong
  dimensions or wrong bytes; breaks layout. (d) **Return `202` with a
  placeholder.** Not available to an `<img>` element. (e) **Drop AVIF from
  `auto` entirely and offer it only explicitly** -- rejected because AVIF's
  compression advantage is the platform's single biggest bandwidth lever,
  and `ADR-008`'s reasoning still holds; the cost just belongs in the
  background rather than on the request.
- Consequences: AVIF encode cost becomes **throttleable**. Because it always
  flows through the queue, the AVIF fleet can run near full utilization on
  cheap ARM or spot capacity with the queue as a buffer, instead of being
  provisioned for p99 request latency -- at the traffic levels this platform
  targets that is a large difference in cost, not a marginal one. The
  protocol gains a specified degradation mode, which is a behaviour every
  conformance implementation must now reproduce
  (`37-PROTOCOL-TESTING.md` gains six cases). A new SLI is required:
  `format_fallback_ratio`, because a persistently high fallback rate is
  otherwise invisible -- every request succeeds, the pages merely weigh more
  than they should. A project whose clients are overwhelmingly AVIF-capable
  will accumulate rarely-requested WebP derivatives; they are small and
  cheap and this is an accepted cost. Finally, this interacts with
  `ADR-014`: with the dimension ladder enabled the derivative set per asset
  version is finite, so AVIF can be generated eagerly at upload time and
  cold AVIF requests become rare -- giving the ladder a second justification
  beyond cardinality control, and reducing progressive upgrade to a safety
  net for arbitrary widths. The ladder stays off by default; this does not
  reverse that.

### ADR-016: Encoder effort, not codec choice, is the cost lever;
    `f=auto` gains a size guard
- Status: Accepted (qualifies ADR-008, replaces the rationale of ADR-015)
- Date: 2026-09-18
- Context: `ADR-008` chose AVIF-first for `f=auto` and left itself an exit
  condition: *"revisit this ADR if AVIF encode cost becomes a measured
  processing-time bottleneck."* `ADR-015` then built an entire progressive
  format upgrade mechanism on the premise that AVIF encoding is expensive
  enough that it cannot sit on the request path. Neither decision had a
  measurement behind it. A benchmark was run to get one
  (`docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md`, 2026-09-18,
  libvips 8.17.3 / libaom 3.13.1, three synthetic fixtures bracketing real
  traffic, single-op cost, median of 7).

  **The measurement refuted the premise.** On photographic content at
  w=1280, AVIF at `effort: 1` costs 120 ms and produces 4 KiB, against JPEG
  at 148 ms / 19 KiB and WebP `effort: 4` at 230 ms / 10 KiB. AVIF at low
  effort is *faster than both* and roughly a fifth the size of JPEG. What is
  expensive is the **effort setting**: the same case at `effort: 4` costs
  1241 ms -- 10.3x -- to save at most one kibibyte, and on the
  high-frequency fixture `effort: 4` reached 19.8 s, a 33x multiple. There
  is a cliff between effort 1 and effort 2, and both sharp defaults (AVIF 4,
  WebP 4) sit on the wrong side of it.

  A second, unrelated finding: AVIF is **not** universally smaller. On the
  high-frequency fixture at w=1280 it produced 769 KiB against JPEG's 261
  KiB -- nearly three times larger -- and WebP also lost to JPEG. AV1's
  transform is built for natural images with structure, and near-random
  detail defeats it. So "always AVIF when the client accepts it" is a
  pessimization for some content: more expensive to produce *and* larger to
  deliver.
- Decision: Three parts.

  **(1) Encoder settings are explicit and low-effort, never the library
  default.** AVIF `effort: 1`, WebP `effort: 2`, JPEG mozjpeg progressive.
  These values live in the **versioned encoder-settings table** that
  participates in `params_hash` under `ADR-014`'s versioned-tables rule,
  because changing `effort` changes the bytes returned for an otherwise
  identical URL and therefore may not change silently.

  **(2) `ADR-008`'s AVIF-first preference stands, with a size guard.** The
  generation job encodes the AVIF candidate and compares its output against
  the cheaper candidate for the same quality tier. When AVIF is not smaller,
  the derivative is marked `avif_not_beneficial`, the format decision for
  that derivative flips to the smaller candidate, and the decision is
  recorded so `f=auto` resolution is deterministic thereafter.

  **(3) `ADR-015`'s progressive upgrade mechanism is retained, with a new
  justification.** It is no longer about AVIF latency -- at effort 1 there is
  no latency problem to solve. It is about the size guard in (2): which
  format wins cannot be known until the candidates have been encoded, and
  encoding two candidates is plainly not request-path work. So the first
  request for a cold `f=auto` derivative still serves the cheap candidate
  under a short TTL while the comparison runs in the background, exactly as
  `ADR-015` specified. Burst absorption remains a real secondary benefit.
- Alternatives considered: (a) **Keep `ADR-015` as written, on its original
  latency rationale** -- rejected because the rationale is measurably false,
  and a mechanism kept for a reason that does not hold is a mechanism nobody
  will maintain correctly. (b) **Drop the progressive upgrade entirely and
  serve AVIF synchronously at effort 1** -- genuinely tempting, and it was
  the conclusion drawn from the first two fixtures. Rejected once the
  high-frequency fixture showed AVIF losing to JPEG by 195%: without a size
  guard the platform would knowingly deliver larger files on a class of real
  content, and the guard cannot run on the request path. (c) **Accept the
  pessimization and always serve AVIF** -- simpler, and defensible on the
  grounds that most real content is photographic where AVIF wins by ~79%.
  Rejected because bandwidth is the product's core claim and a silent 3x
  regression on grainy or foliage-heavy catalogs is the kind of thing a
  customer discovers before we do. (d) **Raise effort for "important"
  derivatives** -- rejected: effort would become part of URL identity, which
  `ADR-015` already rejected for the same reason, and the measurement shows
  it buys at most one kibibyte anyway.
- Consequences: Processing cost drops by roughly an order of magnitude
  against a naive implementation that ships the library defaults -- from
  about 6.2 cores to about 0.6 cores to sustain 5 transforms/second on
  12 MP sources. `P3-01` and `P3-05` must set effort explicitly and pin it
  with a test, because the failure mode here is silent: the defaults work,
  they are just ten times more expensive. The size guard adds a second
  encode per cold `f=auto` derivative, which is economically obvious given
  derivatives are generated once and delivered from cache thereafter, but it
  does mean generation cost roughly doubles for that path and the WebP
  candidate is retained as a derivative in its own right. The format
  decision becomes per-derivative persisted state, so `12-FORMAT-NEGOTIATION.md`
  gains `avif_not_beneficial` alongside `avif_unavailable` and
  `37-PROTOCOL-TESTING.md` gains a case for it. Finally, the benchmark
  itself needs re-running on Linux and ARM and on real photographs before
  any byte figure is published (`docs/WEBSITE/03-LANDING-PAGE-COPY.md`); the
  effort cliff will hold, the absolute numbers will not.

### ADR-017: Two deployables (`api`, `worker`) plus libraries, not one
    service per logical component
- Status: Accepted
- Date: 2026-09-21
- Context: `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md` and `P0-01` described
  five service packages (`api-gateway`, `asset-service`,
  `image-processing-service`, `storage-service`, `search-service`), and the
  earlier engineering documents repeated that layout. Building five
  network-separated services means four extra network hops on the request
  path, distributed transactions or eventual consistency between asset
  metadata and storage, five deployment pipelines, and inter-service
  authentication -- all before the first customer. The boundaries that
  actually carry security and correctness weight (storage abstraction,
  parameter normalization, tenant scoping) are *code* boundaries, and they
  are enforceable as package boundaries without a network in between.
- Decision: v1 ships **two deployables** -- `services/api` (every HTTP
  surface: management, delivery, admin, probes) and `services/worker` (every
  queue consumer) -- plus thirteen libraries under `packages/`. The logical
  services survive as module and package boundaries, each enforced by lint
  or `dependency-cruiser` rather than by a network. The Storage Service
  becomes `packages/storage-adapter`, an in-process library, which is what
  `ADR-001` already implied. One PostgreSQL database, with table ownership
  assigned per module and cross-module access only through service
  functions.
- Alternatives considered: (a) Five services as specified -- rejected for
  the cost above, none of which buys anything at v1 traffic. (b) One
  deployable doing HTTP and queue consumption in the same process --
  rejected because CPU-bound encoding would compete with request latency in
  the same event loop and the same container limits, the exact coupling
  `ADR-007` exists to remove. (c) A separate processing service reached over
  HTTP -- rejected because the queue already provides the decoupling, back
  pressure, and retry semantics an HTTP hop would have to re-implement.
- Consequences: Scaling image processing independently is a replica-count
  change on `worker`. Promoting any module to its own service later is
  mechanical, because modules share packages and never repositories. The
  specification's "each service owns its database" is weakened to "each
  module owns its tables", which is weaker: a lint rule, not a network,
  prevents one module's repository from being imported by another.
  `docs/ENGINEERING/00-CODING-CONTEXT.md` and `02-PROJECT-STRUCTURE.md` were
  corrected to this layout.

### ADR-018: Just-in-time workspace packages, bundler module resolution,
    TypeScript pinned to 5.9
- Status: Accepted
- Date: 2026-09-21
- Context: A pnpm workspace can either build every package to `dist/`
  before its consumers can use it, or have packages export TypeScript
  source directly and let the consumer's toolchain compile it. The engineering
  standard had specified `moduleResolution: NodeNext`, which requires `.js`
  extensions on every relative import and a build step per package. The
  current TypeScript release is 7.0, the native Go port; `typescript-eslint`
  8.70 declares a peer range of `typescript >=4.8.4 <6.1.0`.
- Decision: Packages export their `src/index.ts` directly ("just-in-time"
  packages). Services are bundled by `tsup`, which inlines the workspace
  packages into one self-contained artifact per deployable; tests run
  through Vitest, which compiles TypeScript itself. Every tsconfig uses
  `module: ESNext` and `moduleResolution: Bundler`. TypeScript is pinned to
  `5.9.3` until `typescript-eslint` supports a newer major.
- Alternatives considered: (a) Built packages with project references --
  rejected: a build step per package multiplies CI time and makes every
  cross-package change a two-step edit, for no runtime benefit, since the
  deployables are bundled anyway. (b) `NodeNext` resolution with emitted
  packages -- rejected with (a). (c) TypeScript 7 -- rejected for now;
  type-aware lint is how several of `docs/ENGINEERING/10`'s architectural
  rules are enforced, and losing it to gain compile speed is the wrong trade.
- Consequences: No package is independently publishable as built output; the
  SDKs under `sdks/` are the exception and get their own build. Upgrading
  TypeScript is gated on `typescript-eslint`'s peer range, checked at each
  dependency review. `docs/ENGINEERING/04-TYPESCRIPT-STANDARDS.md` was
  updated from `NodeNext` to `Bundler`.

### ADR-019: Kysely + `pg` as the query layer and migrator
- Status: Accepted
- Date: 2026-09-21
- Context: `AGENTS.md` left the query layer to `P0-06`, naming Prisma,
  Drizzle, or Knex. `docs/ENGINEERING/07` turned the choice into a test: the
  winner must let `scoped()` (`P1-05`) inject a tenant predicate **by
  construction** into reads, updates, and deletes; a caller must be unable to
  remove it; and `INSERT` must take `tenant_id` from context rather than the
  payload. An ORM that cannot express those properties makes `ADR-005`
  unenforceable.
- Decision: **Kysely 0.29** over **node-postgres**. Migrations are Kysely
  migrations registered in a static map (`packages/db/src/migrations/index.ts`)
  so they are bundled into the deployable and run from the production image
  as `node dist/migrate.js`.
- Alternatives considered: (a) **Prisma** -- its generated client owns query
  construction, so a scoping wrapper would sit outside it and every raw
  `$queryRaw` would bypass it; the client also adds a query engine binary to
  the image. (b) **Drizzle** -- a good typed builder, but its schema-first
  model generates migrations from TypeScript table definitions, and this
  project wants hand-written SQL migrations whose constraints (composite
  foreign keys, CHECKs, triggers) are reviewed as SQL. (c) **Knex** -- the
  closest in spirit, but untyped; Kysely is effectively its typed successor.
  Kysely is not in `AGENTS.md`'s list, hence this ADR.
- Consequences: A `where` added to a Kysely builder is ANDed with existing
  predicates, which is exactly property 3 of `scoped()` -- a chained
  predicate cannot replace the tenant filter. Row types are declared by hand
  in `packages/db/src/types.ts` and must be kept in step with migrations;
  the integration tests catch drift because they run real queries. Kysely
  0.29 moved `Migrator` to the `kysely/migration` entry point (found when the
  first migration test failed with "Migrator is not a constructor"). `int8`
  columns are parsed to JavaScript numbers globally, which is safe for every
  byte count and counter on this platform (< 2^53).

### ADR-021: Local disk is the default storage; network filesystems, object
    stores, SFTP and WebDAV are first-class providers
- Status: Accepted (supersedes ADR-002)
- Date: 2026-09-21
- Context: `ADR-002` made an S3-compatible API the v1 baseline and treated
  every other provider as later work. The product owner asked (2026-09-21)
  for the opposite default: storage should be **the disk of the machine the
  platform runs on**, with NFS, object storage, and other network- or
  internet-reachable storage supported alongside it. The request is sound
  on its own terms -- a self-hosted deployment should work with zero cloud
  accounts -- and it changes three things `ADR-002` had settled: the default,
  the provider set, and the assumption that every provider can issue its own
  presigned URLs.
- Decision:
  1. **`STORAGE_PROVIDER` defaults to `local`**: a directory, `.data/storage`
     in development. In production `STORAGE_LOCAL_ROOT` must be set
     explicitly, and the process refuses to start otherwise -- a container
     writing to its own ephemeral filesystem would lose every original on
     restart.
  2. **Network filesystems are the `local` provider.** NFS, SMB/CIFS, AWS
     EFS, Azure Files, CephFS and GlusterFS all present as a mounted
     directory, so one code path serves them. The adapter writes to a temp
     file in the target's own directory, `fsync`s it, and renames it into
     place: rename within a directory is atomic on local filesystems and on
     NFS, and the `fsync` puts the data on the server before the name that
     makes it visible exists.
  3. **Five providers**, each passing the same conformance suite against a
     real server: `local` (and every mounted network filesystem), `s3`
     (AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2, DigitalOcean
     Spaces, Ceph RGW, GCS via S3 interoperability), `azure-blob` (Azure
     has no S3 API), `sftp`, and `webdav`.
  4. **Platform-proxied presigned URLs.** Only S3 and Azure can sign their
     own URLs. For the others, `withProxyPresign()` issues an HMAC token
     binding the key, method, expiry, content type and maximum size, served
     by the platform's own endpoint (`P2-03`). Direct upload therefore works
     identically on every provider; a client cannot tell which kind of URL
     it received.
  5. **Capabilities are declared, not assumed.** Each adapter states
     `nativePresign`; callers branch on the capability, never on the provider
     name.
- Alternatives considered: (a) **Keep S3 as the default and add local as an
  option** -- rejected: it contradicts the stated requirement, and it makes
  the simplest deployment (one machine) the one that needs the most setup.
  (b) **Treat NFS as its own provider** -- rejected: it would duplicate the
  local adapter's code for no behavioural difference; what matters on NFS
  (same-directory rename, fsync before rename) is already what the local
  adapter does. (c) **Local disk without proxy presign, disabling direct
  upload** -- rejected: it would make upload behaviour depend on the storage
  choice, which is exactly the leak `ADR-001` exists to prevent.
  (d) **A generic multi-backend library** (e.g. one virtual-filesystem
  abstraction for everything) -- rejected for the same reason `ADR-002`
  rejected one: a security-relevant path (presigned URLs, path containment)
  should not rest on someone else's abstraction; five small adapters behind
  one tested contract are auditable.
- Consequences: **`local` on more than one host requires a shared
  filesystem.** `api` and `worker` both read and write originals and
  derivatives; on separate machines they must mount the same NFS/SMB/EFS
  export, or originals written by one are invisible to the other. This is
  documented in `docs/STORAGE/10` and `docs/DEVOPS/00`. Filesystem-like
  backends store content types in `.meta/` sidecar files, which object
  stores keep natively; keys can never start a segment with `.`, so the
  sidecars cannot collide with objects. SFTP operations are serialized on one
  SSH connection, which caps its throughput -- positioned for archival and
  low-volume use. Writing the conformance suite found three real bugs before
  any caller existed: a streamed local write that never completed, Windows
  refusing to rename over a file a reader holds open (fixed with a bounded
  retry), and the WebDAV adapter mislabelling an invalid key as a backend
  failure. `ADR-001` stands unchanged; this ADR is how it is now realized.
