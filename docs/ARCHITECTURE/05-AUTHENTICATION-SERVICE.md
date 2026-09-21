# 05 - Authentication Service

> Category: **Architecture** (`docs/ARCHITECTURE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Where authentication lives in the system, what it depends on, and what it
hands to the rest of a request. The security rules are
`docs/SECURITY/03-AUTHENTICATION.md`; this document is the structure.

## Category Mandate

Describes the system as a set of independently deployable services with
explicit boundaries. The platform is designed storage-agnostic and
delivery-agnostic: consumer applications talk to a stable API contract,
never to a storage backend or a processing engine directly.

---

## Not a separate service

Authentication is a **module inside the api deployable**, not a network
service (ADR-017: two deployables). A separate authentication service would
put a network hop and a new failure mode on every request for no isolation
gain: the same database holds the keys either way.

## Components

| Component | File | Responsibility |
|---|---|---|
| Authentication hook | `services/api/src/http/authentication.ts` | Registered first inside the `/v1` scope: route contract (`onRoute`), credential check (`onRequest`), permission check (`preHandler`), `TenantContext` construction |
| Failure limiter | `services/api/src/http/failure-limiter.ts` | Per-address failed-attempt budget (in-memory floor until `P5-03`) |
| API-key service | `services/api/src/modules/api-keys/api-key.service.ts` | `authenticate(presented)` -> principal or null; key lifecycle |
| Credential lookup | `.../api-keys/api-key.authentication.ts` | The pre-tenant query by key id (`unsafeUnscoped`, reason `authenticate-credential`) |
| Last-used tracker | `.../api-keys/last-used-tracker.ts` | Batches `last_used_at` off the request path |
| `TenantContext` | `packages/tenancy` | The value every service and repository receives first |

## Request flow

```
request
  -> onRequest: request id, trace context            (http/request-context.ts)
  -> onRequest: route public?  yes -> skip
                address blocked? -> 429 rate_limited
                Authorization: Bearer <key>? no -> 401 authentication_required
                apiKeys.authenticate(key) -> null -> 401 api_key_invalid
                request.tenant = TenantContext(principal)
  -> body parsing
  -> preHandler: route permission in ctx.permissions? no -> 403 permission_denied
  -> handler(request.tenant, ...) -> service -> repository -> scoped()
```

## Dependencies and failure behavior

- **PostgreSQL** -- one indexed read per authenticated request (key by id,
  joined to its application and tenant). If the database is down,
  authentication fails with `503`, never with a `401` that would tell a
  valid client its key is bad.
- **No cache yet.** Revocation is therefore immediate by construction. A
  credential cache (`docs/ENGINEERING/08`, `img:v1:<t>:apikey:<key_hash>`)
  is added only with synchronous invalidation on revoke/rotate/suspend
  (`SEC-AUTH-05`).
- **Horizontal scaling** -- stateless except the failure limiter and the
  last-used batch, both per-process by design.

## Consistency points

If this changes, change these too: `docs/API/02` (header, status codes),
`docs/SECURITY/03`/`04`, `services/api/src/app.ts` (registration order),
`tests/authentication.test.ts`, `tests/api-keys-http.int.test.ts`.

## Acceptance Criteria

- [x] Every component, its file, and its failure behavior is stated.
- [x] Defaults are stated in `docs/SECURITY/03`.

## Related Documents

- `docs/SECURITY/03-AUTHENTICATION.md`, `04-API-KEY-MANAGEMENT.md`
- `docs/ARCHITECTURE/04-API-GATEWAY.md`
- `MEMORY/DECISIONS.md` (`ADR-017`, `ADR-020`, `ADR-022`)
