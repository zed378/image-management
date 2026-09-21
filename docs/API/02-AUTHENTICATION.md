# 02 - Authentication

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How a client proves who it is to the `/v1` API. Server-to-server clients
use an API key; the dashboard's user sessions are specified with the
dashboard (`P6-09`).

## Category Mandate

The platform is API-first. Every capability exposed to a consumer
application is defined here as a versioned, documented HTTP contract before
it is implemented. These documents are the source of truth for
request/response shapes, status codes, and error formats -- SDKs and the
dashboard are clients of this contract, not the other way around.

---

## Presenting a key

```http
GET /v1/applications/01J8.../api-keys HTTP/1.1
Authorization: Bearer ak_live_01J8Z3K4M5N6P7Q8R9S0T1V2W3_q7Xc0cKf2Qn9V-1s3oZkqj0l8m2nBv6x4AR5eT9uYw0
```

- The scheme is `Bearer` (case-insensitive), followed by exactly one space
  and the key. The key format is in `docs/SECURITY/04`.
- The key is accepted **only** in the `Authorization` header -- never in a
  query parameter, where it would land in access logs, browser history and
  `Referer` headers.
- Every `/v1` route requires a key unless it is explicitly declared public
  (opt-out, not opt-in; `P1-03`). `/healthz` and `/readyz` are outside `/v1`
  and public.

## Responses

| Situation | Status | `error.code` |
|---|---|---|
| No `Authorization` header, or not `Bearer` | `401` | `authentication_required` |
| A key that is malformed, unknown, wrong, expired, revoked, suspended, of the wrong environment, or of a suspended application/tenant | `401` | `api_key_invalid` -- one answer for all, so the response is not an oracle (`SEC-AUTH-04`) |
| An authenticated key without the permission the route needs | `403` | `permission_denied` |
| An authenticated key, a resource that is another tenant's or does not exist | `404` | the resource's `*_not_found` (`SEC-TEN-03`) |

`401` responses carry `WWW-Authenticate: Bearer realm="api"` (RFC 6750).
`401` means "who are you?"; `403` means "I know who you are, and no" --
the distinction is kept exact (`P1-03`).

## What a key grants

A verified key yields its tenant, its application, its permission list, and
its project coverage (every project of the application, or a listed
subset). A request for a project outside that coverage is `404
project_not_found`, not `403`: a key cannot learn that another project
exists.

## Managing keys

| Method and path | Purpose |
|---|---|
| `POST /v1/applications/{application_id}/api-keys` | Issue a key; the response carries the plaintext `key`, once |
| `GET /v1/applications/{application_id}/api-keys` | List keys (prefix, never the secret or a hash) |
| `GET /v1/applications/{application_id}/api-keys/{key_id}` | One key |
| `POST /v1/applications/{application_id}/api-keys/{key_id}/rotate` | Issue a replacement; the old key expires after `overlap_seconds` (default 86400, max 604800) |
| `POST /v1/applications/{application_id}/api-keys/{key_id}/revoke` | Revoke immediately |

| Route | Permission |
|---|---|
| create | `api-key:create` |
| list, get | `api-key:read` |
| rotate | `api-key:update` |
| revoke | `api-key:delete` |

Create body: `{ name, environment: "live"|"test", permissions: [...],
all_projects: true }` or `{ ..., project_ids: [...] }` (exactly one form).
Create and rotate answer `201` with `Location` and the key's wire shape plus
`key` -- the plaintext, the only time it is ever returned. A key cannot
grant more than the key that issues it (`docs/SECURITY/04`). Shapes:
`services/api/src/modules/api-keys/api-key.schema.ts`, `ApiKeyWire` in
`api-key.types.ts`. The first key of an installation comes from the
operator `provision` command.

Repeated failed authentications from one address are answered `429
rate_limited` with `Retry-After` (`docs/SECURITY/03`).

## Acceptance Criteria

- [x] The header scheme, where a key may and may not appear, and every
      failure's status and code are stated.
- [x] Each failure mode maps to a registered code (`docs/API/05`).

## Related Documents

- `docs/SECURITY/03-AUTHENTICATION.md`, `04-API-KEY-MANAGEMENT.md`
- `docs/API/05-ERROR-HANDLING.md`
- `docs/DATABASE/13-API-KEYS.md`
