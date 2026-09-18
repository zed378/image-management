# 08 - Cache & Queue Standards

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands sections 16 and 17 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

Two shared Redis-backed subsystems with one shared failure mode: a key that
forgets which tenant it belongs to, or a job that runs twice and produces
two of something that should exist once. This document specifies both
mechanically.

Three different caches exist in this platform and must not be confused:

| Cache | Key defined by | Invalidated by |
|---|---|---|
| Application cache (Redis) | this document | the service that wrote the data |
| CDN/edge cache | `docs/CDN/01-CACHE-KEY.md`, from `params_hash` | `docs/CDN/` purge API |
| Derivative store (storage) | `docs/STORAGE/04-OBJECT-NAMING.md`, from `params_hash` | asset/version lifecycle |

The last two share `params_hash` by design (ADR-004/009). The first is
unrelated to both, and calling all three "the cache" in a conversation or a
variable name is how the wrong one gets purged during an incident.

---

## Part 1 -- Application cache

### Key format

```
img:v1:<tenant_id>:<entity>:<identifier>[:<discriminator>]
 |   |      |          |          |             |
 |   |      |          |          |             +- optional qualifier
 |   |      |          |          +--------------- the id or hash
 |   |      |          +-------------------------- singular entity name
 |   |      +------------------------------------- always present
 |   +--------------------------------------------- global cache version
 +------------------------------------------------- fixed namespace
```

### The catalogue

Every key in the system is registered here. An unregistered key is not
permitted -- an unknown key is unpurgeable during an incident, and its TTL
is unknown to whoever is paging.

| Purpose | Key | TTL | Invalidated by |
|---|---|---|---|
| Asset metadata | `img:v1:<t>:asset:<asset_id>` | 5 min | asset update/delete |
| Derivative lookup | `img:v1:<t>:derivative:<params_hash>` | 1 h | version change, purge |
| API key resolution | `img:v1:<t>:apikey:<key_hash>` | 5 min | key revocation (immediate) |
| Permission set | `img:v1:<t>:perms:<application_id>` | 5 min | role/permission change |
| Folder tree | `img:v1:<t>:foldertree:<project_id>` | 10 min | folder mutation |
| Quota counter | `img:v1:<t>:quota:<period>` | to period end | metering (incr only) |
| Rate-limit window | `img:v1:<t>:ratelimit:<application_id>:<window>` | window length | expiry only |
| Idempotency record | `img:v1:<t>:idem:<key>` | 24 h | expiry only |
| Distributed lock | `img:v1:<t>:lock:<resource>` | operation timeout | release |

### Rules

- **The tenant id is in every key.** A key without it is a cross-tenant leak
  that no database-level IDOR test will catch, because the database is never
  reached. This is the single most important rule in this document.
- Keys are built only by `cacheKey()` builders in the cache package, never by
  a template literal at a call site. The builder takes `ctx`, so omitting the
  tenant is not expressible.
- `v1:` is a **global version**. A change to any cached value's shape bumps
  it in one place, atomically invalidating everything. Never "deploy and let
  the old entries age out" -- during that window two shapes are live.
- Every `set` names an explicit TTL from a constant. No `set` without one.
- **A cache miss must always be correct.** Every read-through path is
  exercised by a test with the cache disabled. A cache that has become
  load-bearing for correctness is a cache that cannot be flushed, which
  means it cannot be operated.
- Cached values are validated on read with the same Zod schema used to write
  them; an old-shaped entry after a deploy is routine, not exceptional. A
  failed parse is a miss, logged at `debug`, not an error.
- **Invalidation happens after the transaction commits**, in the same service
  function that wrote the data. Invalidating before the commit re-populates
  the cache with the pre-commit value under concurrency.
- Invalidation is a delete, not a write. Writing the new value into the cache
  from the writer races with other writers; deleting lets the next reader
  populate from the source of truth.
- Revocation is immediate, not TTL-based. An API key revocation deletes the
  key's cache entry synchronously; a 5-minute window in which a revoked
  credential still works is a security finding, not a performance
  trade-off.
- Never cache: raw image bytes (that is what storage and the CDN are for),
  an API key's plaintext, a signed URL, or anything in the redaction list
  (section 18).

### Lock pattern

Used where two requests would otherwise both generate the same derivative.

```ts
await withLock(ctx, `derivative:${paramsHash}`, { ttlMs: 30_000 }, async () => {
  const existing = await derivativeRepository.findByParamsHash(ctx, paramsHash);
  if (existing) return existing;
  return generateDerivative(ctx, paramsHash);
});
```

- A lock always has a TTL. A lock without one survives the process that held
  it, and the resource is then unreachable until someone notices.
- A lock is an optimization, never the correctness mechanism. The unique
  constraint on `(tenant_id, project_id, asset_version_id, params_hash)` is
  the correctness mechanism (see
  [`07-REPOSITORY-DATABASE-STANDARDS.md`](./07-REPOSITORY-DATABASE-STANDARDS.md)),
  so the code inside the lock still handles a conflict.
- Never hold a lock across an open database transaction, and never acquire
  two locks in two different orders in two code paths.

---

## Part 2 -- Queues and workers

ADR-007: image processing and webhook delivery never run on the request
path. The API tier's latency profile must not depend on libvips or on a
consumer's webhook endpoint being up.

### Queues

| Queue | Jobs | Concurrency | Notes |
|---|---|---|---|
| `image-processing` | `generate-derivative`, `extract-metadata` | CPU-bound, from config | libvips is the bottleneck; do not over-subscribe cores |
| `webhook-delivery` | `deliver-webhook` | I/O-bound, higher | third-party latency; aggressive backoff |
| `maintenance` | `sweep-orphans`, `recompute-usage`, `expire-derivatives` | low | scheduled, off-peak |

### Job naming and payload

- Queue and job names are `kebab-case`, exported as `as const` from the job
  module. A string literal at an `add()` call site is a job that silently
  never runs.
- The payload carries **ids only**: no domain objects, no image bytes, no
  credentials. Bytes live in storage; the job carries the object key.
- The payload carries `tenantId`, `projectId`, and `requestId`. The first two
  so the worker can build a `TenantContext` and use scoped repositories; the
  third so a derivative can be traced back to the request that asked for it.
- The payload has a Zod schema, parsed at the top of the handler. A job is
  untrusted input: it may have been enqueued by a previous deploy with a
  different shape, and it may sit in Redis across a release.

### Idempotency -- the rule with no exceptions

Delivery is at-least-once. Therefore **every handler must be a no-op on
redelivery.** Three layers, in order:

1. **A deterministic `jobId` from the natural key.** For a derivative,
   `${assetVersionId}:${paramsHash}` -- the queue deduplicates before the
   handler ever runs.
2. **An existence check at the top of the handler.** The job may have been
   enqueued before a previous attempt completed.
3. **A database unique constraint.** The last line of defence, because 1 and
   2 both race. The handler handles the conflict rather than assuming it away.

A handler that is idempotent only because of layer 1 is not idempotent --
`jobId` deduplication has a retention window, and a redelivery after that
window looks brand new.

### Retry and failure

```ts
{
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },  // 2s, 4s, 8s, 16s, 32s
  removeOnComplete: { age: 3_600 },
  removeOnFail: false,                              // keep the payload for the DLQ path
}
```

- `attempts` and `backoff` are explicit per job type, never inherited from a
  library default.
- **Retry only what is retryable.** An `AppError` with `retryable: false`
  (an unsupported media type, a decode failure, a deleted asset) must fail
  immediately and permanently. Retrying a permanent failure five times
  wastes a worker slot and delays real work; a poison job that retries
  forever is an outage.
- Failed jobs retain their payload (`removeOnFail: false`) so the
  dead-letter inspection and replay path (`P6-04`) has something to work
  with.
- A DLQ entry is an alert with a runbook, not a graveyard. If nobody looks
  at it, the queue's failure mode is silent data loss.
- Webhook delivery additionally follows `docs/WEBHOOK/`'s retry schedule and
  signing rules -- where the two differ, that category wins for that job.

### Worker rules

- A worker is a separate process with its own entry point. It MUST NOT
  import an HTTP controller or a route.
- A worker builds a `TenantContext` from the payload and uses scoped
  repositories, exactly like the API. "It is internal" is not an exemption
  from ADR-005 -- a worker with an unscoped query is the same leak with less
  visibility.
- Every handler logs start and outcome with `request_id`, `job_id`, and the
  domain ids. Duration goes to a metric, not only a log line.
- **Graceful shutdown:** on `SIGTERM`, stop accepting new jobs, let in-flight
  jobs finish within a bounded drain period, close Redis and the pool, exit
  0. A hard kill mid-job is safe precisely because of the idempotency rule --
  which is the argument for that rule, not a reason to skip the shutdown
  handling.
- A handler has a timeout. An unbounded handler holds a worker slot forever;
  one stuck derivative should not consume the queue's capacity.
- Concurrency, rate limits, and drain periods are configuration, not code
  constants -- they are tuned against the load tests in `P7-05`.

### Scheduled jobs

- Declared in one place per service, with the cron expression, the timezone
  (always UTC), and a comment naming what it does and why that cadence.
- A scheduled job must be safe to skip and safe to run twice -- a deploy
  window will do both.
- A scheduled job that scans tenant data processes in bounded batches with a
  resumable cursor. An unbounded scan grows until it times out, and then it
  never completes again.

## Acceptance Criteria

- [x] Every application-cache key in the system is catalogued with a TTL and
      an invalidation trigger.
- [x] The three caches are distinguished explicitly, with the key authority
      for each.
- [x] The three idempotency layers are specified with the reason none of them
      suffices alone.
- [x] Retryable versus permanent failure is specified, tied to
      `AppError.retryable` from
      [`06-ERROR-RESPONSE-STANDARDS.md`](./06-ERROR-RESPONSE-STANDARDS.md).

## Open Questions

- Concurrency defaults and the drain period are set from the `P7-05` load
  tests (`docs/PERFORMANCE/`); the values in config today are placeholders.
- Whether `maintenance` runs in its own deployable or alongside the
  processing worker is a `P0-01`/`P6-04` decision.
- The derivative cache TTL (1 h) is a guess until `docs/PLAN/13-CACHING-STRATEGY.md`
  and `docs/CDN/` are finalized; the catalogue is the place it gets
  corrected.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (sections 16, 17)
- `docs/ARCHITECTURE/11-CACHE-ARCHITECTURE.md`, `12-QUEUE-WORKER-ARCHITECTURE.md`
- `docs/CDN/01-CACHE-KEY.md` (the edge cache -- a different thing)
- `docs/STORAGE/04-OBJECT-NAMING.md` (the derivative store -- also different)
- `docs/PLAN/13-CACHING-STRATEGY.md`
- `docs/WEBHOOK/` (delivery retry and signing)
- `MEMORY/DECISIONS.md` (`ADR-004`, `ADR-007`, `ADR-009`)
- `TASKS/PHASE-6-SEARCH-WEBHOOKS-SDK-DASHBOARD.md` (`P6-04` sweeper/DLQ)
