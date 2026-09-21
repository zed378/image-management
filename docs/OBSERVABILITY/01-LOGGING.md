# 01 - Logging

> Category: **Observability** (`docs/OBSERVABILITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The operational contract for logs: what a line contains, which fields are
guaranteed, what never appears, and how lines from different processes are
joined. The code-level conventions (field vocabulary, levels, how to write a
log call) are in `docs/ENGINEERING/12-LOGGING-CONVENTIONS.md`; this document
is the operator's view of the same thing.

## Category Mandate

Logging, metrics, and tracing across every service boundary, plus the
SLIs/SLOs and alerting rules that turn raw telemetry into an operable signal.

---

## Format

One JSON object per line on stdout, produced by `createLogger()` in
`packages/logger` (pino). The process never writes files, rotates, or ships
logs; the platform's log collector does.

```json
{"level":"info","time":"2026-09-21T09:35:35.512Z","service":"api","version":"1.4.0",
 "request_id":"01J8Z3...","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","span_id":"00f067aa0ba902b7",
 "tenant_id":"01J8...","project_id":"01J8...","asset_id":"01J8...","msg":"asset created"}
```

## Guaranteed fields

| Field | On | Source |
|---|---|---|
| `level` | every line | label (`info`), not pino's number |
| `time` | every line | ISO 8601 UTC with milliseconds |
| `service` | every line | `api` or `worker` |
| `version` | every line | `SERVICE_VERSION` |
| `msg` | every line | short, stable, lowercase |
| `request_id` | every line inside a request | ULID, echoed as `X-Request-Id` |
| `trace_id`, `span_id` | every line inside a request or job | W3C trace context (`03-DISTRIBUTED-TRACING.md`) |
| `tenant_id`, `project_id`, `application_id` | every line after authentication | the verified credential |
| `err` | every error line | `{ type, message, stack }` |

`request_id` identifies one inbound HTTP request. `trace_id` identifies the
whole causal chain -- the request, the jobs it enqueued, and the work those
jobs did in `worker`. To follow one upload end to end, filter on `trace_id`.

## Levels

| Level | Meaning | Production default |
|---|---|---|
| `fatal` | the process is about to exit | on |
| `error` | a human must look; 5xx; data at risk | on |
| `warn` | degraded or notable client behaviour; 4xx | on |
| `info` | a state change worth an audit trail | on |
| `debug` | development detail; may include normalized parameters and payloads | **off** |
| `trace` | not used | off |

A 4xx is not an `error`. Expected 404s on the delivery path are not logged
beyond the access log.

## What never appears

Enforced by pino redaction in `packages/logger/src/redact.ts`, replacing the
value with `[redacted]`:

- `Authorization`, `Cookie`, `X-Api-Key` request headers; `Set-Cookie` response header;
- fields named `api_key`/`apiKey`, `secret`, `password`, `signature`,
  `token`, `access_token`, `refresh_token`, `signing_secret`,
  `secret_access_key`, `presigned_url`, `signed_url` (and camelCase forms)
  at the top level **or one level down**;
- `err.config.headers.authorization` (HTTP-client errors).

URLs are passed through `redactUrl()` before logging, which replaces the
values of `sig`, `s`, `signature`, `token`, `api_key`, `X-Amz-Signature`,
`X-Amz-Credential`, and `X-Amz-Security-Token` query parameters while
keeping the path and the transformation parameters.

### The limit of redaction, stated plainly

Redaction matches **field names at a fixed depth**. It does not catch:

- a secret two or more levels deep (`{ a: { b: { password } } }`) -- a test
  in `logger.test.ts` pins this boundary deliberately;
- a secret inside a message string or under an unexpected field name;
- a secret inside an object whose keys are not in the list.

Redaction is the safety net. The rule is not to log credential-bearing
objects in the first place (`docs/ENGINEERING/12`). Every redaction path is
covered by a test that pushes a sentinel secret through the real logger and
asserts it does not appear in the output.

## Audit logging is separate

Security-relevant actions (key issuance and revocation, permission changes,
admin access, hard deletes) are written to the `audit_logs` table (`P1-07`),
not only to the log stream: that trail must be queryable per tenant,
retained per policy, and not lost when a log shipper is down.

## Acceptance Criteria

- [x] Format, guaranteed fields, and levels are specified and implemented in
      `packages/logger`.
- [x] Redaction is enforced by a tested mechanism, with each path covered by
      a sentinel test.
- [x] The limits of redaction are documented and pinned by a test rather
      than left to be discovered.
- [x] Correlation across processes is by `trace_id`, specified in
      `03-DISTRIBUTED-TRACING.md`.

## Open Questions

- The log collector and retention period depend on the hosting choice
  (`docs/DEVOPS/00-ENVIRONMENT.md`); logs contain tenant identifiers, so
  retention must be set against `docs/PLAN/16-RETENTION-POLICY.md`.
- Sampling of high-volume delivery-path lines is decided with `P7-05`'s load
  test.

## Related Documents

- `packages/logger/`
- `docs/ENGINEERING/12-LOGGING-CONVENTIONS.md`
- `docs/OBSERVABILITY/03-DISTRIBUTED-TRACING.md`
- `docs/DEVOPS/04-SECRETS-MANAGEMENT.md`
