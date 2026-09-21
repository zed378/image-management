# 03 - Authentication

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How the platform establishes *who* is making a request, and the guarantees
that step gives everything after it. The credential format and lifecycle
are in [`04-API-KEY-MANAGEMENT.md`](./04-API-KEY-MANAGEMENT.md); the wire
contract is `docs/API/02-AUTHENTICATION.md`.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

---

## Principals

| Principal | Credential | Status |
|---|---|---|
| Server-to-server client | API key, `Authorization: Bearer ak_...` | v1 (`P1-02`, `P1-03`) |
| Dashboard user | session (OIDC login, `06-OIDC.md`) | `P6-09` |
| Platform operator | the `provision` command and the admin surface, run inside the deployment | CLI now; admin API `docs/API/20` |

## Guarantees (each tested)

1. **Authenticated by default.** Every `/v1` route requires a credential
   unless it is declared `public: true`; a route that declares neither a
   permission nor `public` fails to register (`SEC-AZ-01`). Opt-out, never
   opt-in (`services/api/src/http/authentication.ts`,
   `tests/authentication.test.ts`).
2. **The tenant comes from the credential, and only from it**
   (`SEC-TEN-01`). The `TenantContext` is built from the verified
   principal; a `tenant_id` in a header, query string, body or path is never
   read (tested with both present).
3. **401 vs 403 is exact.** No credential or a bad credential: `401`, with
   `WWW-Authenticate: Bearer realm="api"`. A good credential without the
   route's permission: `403 permission_denied`. A resource the credential's
   tenant does not own: `404`, never `403` (`SEC-TEN-03`).
4. **One answer for every bad key** (`SEC-AUTH-04`): malformed, unknown,
   wrong secret, wrong environment, expired, revoked, suspended, or of a
   suspended application/tenant are all `401 api_key_invalid`, and lookup
   timing does not reveal whether a key id exists.
5. **Before the body.** Authentication runs in `onRequest`, before the body
   is read, so an unauthenticated upload is refused without accepting it.
6. **Failed attempts are limited** (`SEC-AUTH-06`, floor): after 20 failed
   authentications from one address within 60 seconds, that address gets
   `429 rate_limited` with `Retry-After` for the rest of the window --
   including for a valid key, since the address is the unit. Successes do
   not count. In-memory per process (bounded to 10,000 addresses); `P5-03`
   moves it to Redis, shared across processes.
7. **No escalation through credentials.** A key can only issue, or rotate,
   a key whose permissions and project coverage are within its own
   (`04-API-KEY-MANAGEMENT.md` "Issuance").
8. **Nothing secret is logged.** The request log line carries `tenant_id`
   and the non-secret `key_id`; the `Authorization` header is redacted
   (`docs/OBSERVABILITY/01`), and an end-to-end run was checked for key
   material in the logs.

## Order of the request pipeline

`onRequest`: request id and trace context -> **authentication** (and the
failure limiter) -> body parsing -> `preHandler`: **permission check** ->
handler. The error handler renders every refusal as the standard envelope.

## Acceptance Criteria

- [x] Every guarantee names its enforcement and is covered by a test.
- [x] Defaults stated: failure budget (20 / 60 s / 10,000 addresses).

## Related Documents

- `docs/SECURITY/04-API-KEY-MANAGEMENT.md`, `07-AUTHORIZATION.md`, `15-RATE-LIMITING.md`
- `docs/API/02-AUTHENTICATION.md`
- `docs/ARCHITECTURE/05-AUTHENTICATION-SERVICE.md`
