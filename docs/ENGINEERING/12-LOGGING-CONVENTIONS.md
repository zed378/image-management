# 12 - Logging Conventions

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 18 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

> `docs/OBSERVABILITY/` is normative for metrics, traces, SLOs, and
> alerting. This document covers log *code*: the logger, the field
> vocabulary, the levels, and the redaction contract.

## Purpose

A log line in this platform has two jobs that pull in opposite directions:
carry enough to debug a single derivative across an API process, a queue,
and a worker; and carry nothing that would turn the log store into a
secondary credential store. The redaction rules below are the part that is
non-negotiable -- a signed URL in a log file is a bypass of the entire
signed-URL mechanism (ADR-006).

## One logger

```ts
// packages/logger/src/logger.ts
import pino from "pino";

export const createLogger = (opts: LoggerOptions): Logger =>
  pino({
    level: opts.level,
    base: { service: opts.serviceName, version: opts.version },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  });
```

- JSON to stdout. The process does not write files, does not rotate, and
  does not ship -- the platform around it does
  (`docs/DEVOPS/09-MONITORING.md`).
- One logger instance per service, child loggers per request and per job.
- `console.*` is banned by lint in `services/*` and `packages/*` (doc 10).
  It bypasses redaction, levels, and structure all at once.

## Structured, always

```ts
// Correct
logger.info({ asset_id: asset.id, byte_size: asset.byteSize }, "asset created");

// Wrong -- unaggregatable, and the id cannot be indexed
logger.info(`created asset ${asset.id} of ${asset.byteSize} bytes`);
```

- The message is a **short, stable, lowercase** string. Stable means
  searchable: `"asset created"` stays that string across releases, so a
  dashboard counting it keeps working.
- Everything variable is a field. No interpolation in the message, ever.
- Field names are `snake_case` and match the API/DB name for the same
  concept. `asset_id` in a log, `asset_id` in a response, `asset_id` in a
  column -- one string to grep across all three.

## Field vocabulary

Registered names, used consistently. An ad hoc field name is a field nobody
will think to query.

| Field | Meaning | On |
|---|---|---|
| `request_id` | ULID per inbound request | every request-scoped line |
| `trace_id`, `span_id` | OpenTelemetry correlation | every line, when tracing is on |
| `tenant_id`, `project_id`, `application_id` | The tenancy chain | every authenticated line |
| `route`, `method`, `status`, `duration_ms` | HTTP | request completion |
| `asset_id`, `asset_version_id`, `derivative_id` | Domain ids | where relevant |
| `params_hash` | Normalized transform identity | processing + delivery |
| `object_key` | Storage object | storage operations |
| `cache_key` | Application cache key (never the value) | cache operations |
| `cache_result` | `hit` \| `miss` \| `stale` | cache operations |
| `job_id`, `job_name`, `attempt` | Queue | every worker line |
| `code` | The `AppError` code | every failure |
| `storage_provider` | `s3` \| `local` | storage operations |
| `bytes_in`, `bytes_out` | Transfer sizes | upload, delivery |

### Request and job context

The logging middleware creates a child logger with `request_id`,
`tenant_id`, `project_id`, `route`, and `method` bound. Services do not
re-add them; a service that passes `tenant_id` explicitly is a service that
will eventually pass the wrong one.

Workers do the same from the job payload, binding the **originating**
`request_id` -- which is why the payload carries it (doc 08). One
`request_id` should retrieve the API request, the enqueue, the worker run,
and the delivery of the resulting derivative.

## Levels

| Level | Means | Example |
|---|---|---|
| `error` | A human must look. Something is broken or data is at risk. | storage unreachable, unhandled error, DLQ arrival |
| `warn` | Degraded, self-healing, or a client did something notable | retry succeeded, quota near limit, rate limit engaged |
| `info` | A state change worth an audit trail | asset created, derivative generated, key revoked |
| `debug` | Development detail | cache miss, normalized params, job payload |
| `trace` | Not used in this codebase | -- |

Rules:

- **A 4xx is not an `error`.** A client sending a malformed parameter is the
  system working. Expected 404s on the delivery path are not logged at all
  beyond the access log (`docs/OBSERVABILITY/`) -- a public CDN origin will
  see them constantly.
- Only a 5xx, or a condition requiring intervention, is `error`. An error
  log that fires on normal traffic trains everyone to ignore it, and then
  the real one is invisible.
- `info` is for state changes, not progress narration. "entering
  createAsset" is `debug` at best and usually nothing.
- No logging inside a tight loop. Log the aggregate: one line with
  `processed_count`, not one line per item.
- Production default is `info`, from `LOG_LEVEL`. `debug` in production is a
  deliberate, temporary act -- `debug` lines may carry normalized params and
  payloads, which is exactly why they are off by default.

## Redaction -- the non-negotiable part

```ts
// packages/logger/src/redact.ts
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "*.api_key",
  "*.apiKey",
  "*.secret",
  "*.password",
  "*.signature",
  "*.signing_secret",
  "*.access_key_id",
  "*.secret_access_key",
  "*.presigned_url",
  "*.signed_url",
  "*.token",
  "*.refresh_token",
  "err.config.headers.authorization",
] as const;
```

The list above is illustrative; the source of truth is
`packages/logger/src/redact.ts`, and every path in it is covered by a
sentinel test in `logger.test.ts`. Redaction matches field names at the top
level and **one level down only** -- a secret nested deeper is not caught,
and a test pins that boundary so nobody assumes more coverage than exists
(`docs/OBSERVABILITY/01-LOGGING.md`). URLs go through `redactUrl()` before
logging.

**Never logged, at any level, including `debug`:**

| Never | Because |
|---|---|
| An API key, raw or partial | A partial key narrows a brute force; a full key is a credential in the log store |
| A signed-URL signature | It is the access grant. A log line with it is that grant, re-issued to everyone with log access (ADR-006) |
| A presigned storage URL | Same, for the storage backend directly, bypassing the platform entirely |
| An HMAC or signing secret | Forges every signature for that application |
| An `Authorization` or `Cookie` header | Contains the above |
| Raw image bytes or a buffer | Floods the log store and may contain personal content |
| A full request body on an upload | Same |
| A database connection string | Contains a password |
| Personal data beyond what `docs/SECURITY/` permits | Compliance, and it is rarely needed for debugging |

What to log instead: a stable, non-reversible reference. `key_id` (not the
key), `key_hash_prefix` (first 8 characters of the *hash*, never of the
key), `object_key` (not the presigned URL), `signature_valid: false` (not
the signature).

**Enforcement.** This is tested, not trusted: a test constructs a log
context containing a known sentinel secret in each of the shapes above,
serializes it through the real logger, and asserts the sentinel does not
appear in the output. That test is part of
`packages/logger`'s 100%-covered surface (doc 09). A redaction rule that is
not tested is a redaction rule that a refactor will silently remove.

## Errors in logs

```ts
logger.error({ err, code: err.code, request_id: ctx.requestId }, "request failed");
```

- Pass the error as `err` so pino's serializer handles the stack. Never
  `String(err)`, which loses it, and never `err.message` alone.
- Include `code` as its own field so failures can be counted by code without
  parsing the message.
- Log an error **once**, at the boundary that handles it -- the error
  middleware for a request, the job handler for a job. Logging at every
  level on the way up produces four lines for one failure and makes error
  counts meaningless.
- An expected, handled condition (a cache miss, a 404) is not an error log.

## Audit logging is not application logging

`docs/SECURITY/` requires an audit trail for security-relevant actions --
key issuance and revocation, permission changes, cross-tenant admin access,
asset deletion. That trail is a **database table**, not a log line:

- it must be queryable per tenant and retained per
  `docs/PLAN/16-RETENTION-POLICY.md`;
- it must survive log rotation and log-store retention;
- it must not be lossy when the log shipper is down.

An `info` log line about the same event is fine and useful. It is not the
audit trail, and a task that writes only the log line has not satisfied
`docs/SECURITY/`.

## Acceptance Criteria

- [x] The field vocabulary is registered, so field names are consistent
      across services and match the API/DB names.
- [x] The never-log list gives the reason each entry is dangerous, and a
      safe alternative to log instead.
- [x] Redaction is enforced by a specified test rather than by convention.
- [x] Audit logging is explicitly distinguished from application logging.

## Open Questions

- The access-log format and whether it is separate from the application log
  is a `docs/OBSERVABILITY/` decision (`P0-05`, `P7-01`).
- Sampling for `debug` and for high-volume delivery-path lines is set
  alongside the `P7-05` load tests.
- Whether `trace_id` is injected by the logger or by an OpenTelemetry pino
  hook is a `P0-05` implementation detail.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 18)
- `docs/OBSERVABILITY/` (normative for metrics, traces, SLOs, alerting)
- `docs/SECURITY/` (the audit trail requirement)
- `docs/SECURITY/12-SIGNED-URL.md`, `MEMORY/DECISIONS.md` (`ADR-006`)
- `docs/PLAN/16-RETENTION-POLICY.md` (audit retention)
- `TASKS/PHASE-0-FOUNDATION.md` (`P0-05` builds the logger)
