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
- Status: Accepted
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
- Status: Accepted
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
