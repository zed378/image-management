# 04 - API Gateway

> Category: **Architecture** (`docs/ARCHITECTURE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The edge of `services/api`: what every request passes through before a route
handler runs, the health probes, and the process lifecycle. In v1 the gateway
is not a separate service but the middleware chain of the api deployable
(`ADR-017`).

## Category Mandate

Describes the system's components and their boundaries.

---

## Framework

**Fastify 5** (`ADR-020`), built by `buildApp()` in `services/api/src/app.ts`.
`app.ts` only composes; `server.ts` connects dependencies and listens.
Integration tests call `buildApp()` and never bind a port.

## The request pipeline

Fixed order; later tasks insert their stage at the marked position and never
reorder the others (`docs/ENGINEERING/01`, section 5):

| # | Stage | Implemented in | Status |
|---|---|---|---|
| 1 | Request id (ULID, generated -- never taken from the client) | `genReqId` | `P0-08` |
| 2 | Trace context (continue `traceparent` or start), child logger with `request_id`, `trace_id`, `span_id` | `http/request-context.ts` | `P0-08` |
| 3 | Body limit (1 MiB JSON) and parsing | Fastify `bodyLimit` | `P0-08` |
| 4 | Authentication | `P1-03` | pending |
| 5 | Tenant context from the verified credential | `P1-03`, `P1-05` | pending |
| 6 | Rate limiting | `P5-03` | pending |
| 7 | Permission check | `P1-04` | pending |
| 8 | Idempotency (mutating routes) | `P2-02` | pending |
| 9 | Schema validation | per route | per task |
| 10 | Handler | per route | per task |
| -- | Completion log line, error envelope | `onResponse`, error handler | `P0-08`, `P0-09` |

Every response carries `X-Request-Id` and `traceparent`. Every request
produces exactly one `request completed` log line with `method`, `route`
(the route pattern, not the raw path, so it aggregates), `url` passed
through `redactUrl()`, `status`, and `duration_ms`; 5xx at `error`, the rest
at `info`.

## Probes

| Probe | Checks | 200 | 503 |
|---|---|---|---|
| `GET /healthz` | nothing external | the process serves HTTP | never |
| `GET /readyz` | PostgreSQL `select 1`, Redis `PING`, storage `stat` of a probe key -- each with a 2 s timeout | every check ok | any check failing or timing out |

Liveness deliberately checks nothing external: a database outage must take
replicas out of the load balancer (readiness), not make the orchestrator
restart every healthy process (liveness). Both probes are unauthenticated
and reveal only check names and `ok`/`failing` -- never hostnames, versions,
or error messages; the cause goes to the log.

## Lifecycle

1. Load and validate configuration; exit `1` on any problem.
   `--check-config` validates and exits `0`, for deploy pipelines.
2. Create the logger, database pool (with an `error` handler -- see below),
   Redis client, and storage adapter (lazily loading only the configured
   provider's library).
3. Build the app, connect Redis (not fatal: readiness reports it), listen.
4. On `SIGTERM`/`SIGINT`: stop accepting, drain in-flight requests
   (`app.close()`), release database, Redis, and storage connections, exit
   `0`. A second signal forces exit.

**Idle-connection errors never crash the process.** When PostgreSQL
restarts or fails over, idle pooled connections receive `FATAL 57P01` and the
pool emits `error`; without a listener that event kills Node. The pool and
the Redis client both have handlers that log the event -- found by the
readiness integration test, which stops a real PostgreSQL.

## Proxies

`trustProxy` is off by default. Behind a load balancer it is set to the
balancer's addresses, so `request.ip` (used by rate limiting, `P5-03`) is the
client's, and a client cannot spoof it with its own `X-Forwarded-For`.

## Acceptance Criteria

- [x] `/healthz` and `/readyz` exist; `/readyz` fails when PostgreSQL or
      Redis is down -- verified by stopping the real dependency
      (`services/api/tests/readiness.int.test.ts`).
- [x] The pipeline order is stated with the task that fills each stage.
- [x] Correlation is verified: a request yields one completion line carrying
      `request_id` and the continued `trace_id` (`services/api/tests/app.test.ts`).

## Open Questions

- The worker's own health endpoint (queue depth, consumer liveness) arrives
  with its consumers (`P3-09`).

## Related Documents

- `services/api/src/app.ts`, `server.ts`, `http/`, `modules/health/`
- `docs/API/01-API-STANDARDS.md`
- `docs/OBSERVABILITY/01-LOGGING.md`, `03-DISTRIBUTED-TRACING.md`
- `MEMORY/DECISIONS.md` (`ADR-017`, `ADR-020`)
