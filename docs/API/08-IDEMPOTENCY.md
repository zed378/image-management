# 08 - Idempotency

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How a client retries a create safely. A network failure after the server
acted but before the client heard back is normal; without idempotency, the
retry creates a duplicate asset.

## Category Mandate

The platform is API-first. Every capability exposed to a consumer
application is defined here as a versioned, documented HTTP contract before
it is implemented. These documents are the source of truth for
request/response shapes, status codes, and error formats -- SDKs and the
dashboard are clients of this contract, not the other way around.

---

## The header

`Idempotency-Key: <1-255 printable ASCII characters>`, on any create that
supports it (today: `POST /v1/projects/{id}/assets`; later every
non-idempotent write in a project). A UUID or ULID per logical operation is
the intended use. An invalid key is `400 validation_failed`.

## Behavior

| Situation | Answer |
|---|---|
| First request with the key | Runs; its response (status and body) is stored for 24 hours |
| Retry of **the same request** with the key | The stored response, same status, with `Idempotent-Replayed: true`; nothing runs again |
| Same key, **a different request** | `409 idempotency_key_reused` (a client bug) |
| Retry while the first is still running | `409 idempotency_request_in_progress` -- retryable |
| The first request **failed** | The key is released; a retry runs normally |
| After 24 hours | The key is forgotten and may be reused |

"The same request" means the same method, route, project, form fields,
filename and file bytes (a SHA-256 fingerprint; `request_hash`).

Keys are scoped to the project: two projects (or tenants) can use the same
key without interfering.

## Storage

`idempotency_keys` (`docs/DATABASE/00` "Supporting tables"), primary key
`(tenant_id, project_id, key)`; claiming a key is an `INSERT ... ON
CONFLICT DO NOTHING`, so two concurrent first requests cannot both run.

## Acceptance Criteria

- [x] Every case above is specified and tested
      (`services/api/tests/assets-upload.int.test.ts`).

## Related Documents

- `docs/API/11-UPLOAD-API.md`
- `docs/ENGINEERING/07-REPOSITORY-DATABASE-STANDARDS.md` (idempotency constraints)
- `MEMORY/DECISIONS.md` (`ADR-022` point 10)
