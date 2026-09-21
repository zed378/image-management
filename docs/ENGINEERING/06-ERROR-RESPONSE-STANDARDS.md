# 06 - Error & Response Standards

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands sections 12 and 13 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

> **Normative wire contract:** `docs/API/01-API-STANDARDS.md` and
> `docs/API/05-ERROR-HANDLING.md`. This document specifies the *code-side*
> mechanism -- the classes, the registry, the helpers, the middleware -- and
> proposes the envelope those two documents ratify in `P0-09`.

## Purpose

One error channel, one envelope, one place that knows about HTTP status
codes. Errors are a product surface: an SDK branches on `error.code`, a
consumer's retry logic branches on `retryable`, and a support engineer
searches for `request_id`. All three of those depend on these shapes being
stable and identical across every endpoint.

## The `AppError` contract

As implemented in `packages/errors` (`P0-09`). One class, not a hierarchy:
status and retryability are **looked up from the code's registry entry**, so
a code cannot be thrown with the wrong status -- "one code, one status" holds
by construction rather than by discipline.

```ts
// packages/errors/src/codes.ts (excerpt)
export const ERROR_CODES = {
  asset_not_found: { status: 404, retryable: false, message: "No asset with that id exists." },
  rate_limited:    { status: 429, retryable: true,  message: "Too many requests; slow down." },
  quota_exceeded:  { status: 429, retryable: false, message: "The plan quota for this period is exhausted." },
  storage_unavailable: { status: 503, retryable: true, message: "Storage is temporarily unavailable." },
  // ... the full v1 taxonomy: docs/API/05-ERROR-HANDLING.md
} as const satisfies Record<string, ErrorCodeSpec>;

// packages/errors/src/app-error.ts
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;        // from the registry
  readonly retryable: boolean;    // from the registry
  readonly details: readonly ErrorDetail[];
  readonly expose: boolean;       // false for every 5xx
  constructor(code: ErrorCode, options?: { message?: string; details?: ErrorDetail[]; cause?: unknown });
  get publicMessage(): string;    // own message for 4xx, registry default for 5xx
}
```

Throw sites:

```ts
throw new AppError("asset_not_found");
throw new AppError("invalid_transform_param", {
  message: "Parameter 'w' must be between 1 and 8192.",
  details: [{ field: "w", reason: "out_of_range" }],
});
throw new AppError("storage_unavailable", { cause: err }); // cause is logged, never sent
```

| Field | Consumed by |
|---|---|
| `status` | the error handler, and nothing else |
| `code` | SDKs and consumer applications, which branch on it |
| `message` / `publicMessage` | humans; never parsed |
| `details` | a form or SDK mapping a failure back to a field |
| `retryable` | job handlers and SDK retry logic |
| `expose` | the handler, deciding whether the message is safe to send |

`rate_limited` and `quota_exceeded` share 429 but differ in `retryable`: a
rate limit clears on its own, a quota does not until the period resets.
Collapsing them would make every SDK retry a quota failure for the rest of the
billing period.

## Error codes

The registry in `packages/errors/src/error-codes.ts` is the complete list;
section 12 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md) shows its
shape. Rules:

- A code is `snake_case`, `<subject>_<problem>`, and names the domain
  concept, not the HTTP status. `asset_not_found`, not `not_found_404`.
- **A released code never changes meaning.** Clients branch on it; that makes
  it part of the public contract as much as a field name. Adding one is
  cheap, repurposing one is a breaking change requiring the deprecation path
  in `docs/API/04-API-VERSIONING.md`.
- A code maps to exactly one status. Two statuses for one code means the
  code is describing two different things.
- Every code appears in `docs/DEVELOPER/10-ERRORS.md` with a description and
  a remediation. A code a consumer cannot look up is a support ticket.
- The registry is covered 100% by a test that asserts every code has a
  default message and a documented status -- cheap, and it catches the
  half-added code.

## Response helpers

```ts
// packages/errors/src/respond.ts
export const ok = <T>(res: Response, data: T, meta?: ResponseMeta): void => {
  res.status(200).json({ data, meta: withRequestId(res, meta) });
};

export const created = <T>(
  res: Response,
  data: T,
  opts: { location: string },
): void => {
  res.setHeader("Location", opts.location);
  res.status(201).json({ data, meta: withRequestId(res) });
};

export const accepted = <T>(res: Response, data: T): void => {
  res.status(202).json({ data, meta: withRequestId(res) });
};

export const noContent = (res: Response): void => {
  res.status(204).end();
};

export const paginated = <T>(
  res: Response,
  data: readonly T[],
  page: { nextCursor: string | null; hasMore: boolean },
): void => {
  res.status(200).json({
    data,
    meta: withRequestId(res, { next_cursor: page.nextCursor, has_more: page.hasMore }),
  });
};
```

A controller MUST use one of these. A hand-written `res.json({ ... })` is how
one endpoint ends up without `request_id`, or with `data` at the top level,
and it is invisible in review because it looks correct locally.

## The error handler

The only place that maps an error to a status code and a body.

```ts
// services/api/src/http/error-handler.ts (abridged)
export const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new AppError("validation_failed", { details: zodDetails(err) });
  // route-schema (ajv) failures, FST_ERR_CTP_* framework codes and JSON
  // syntax errors each map to their registered code; everything else:
  return new AppError("internal_error", { cause: err });
};

app.setErrorHandler((err, request, reply) => {
  const appError = toAppError(err);
  if (appError.status >= 500) {
    request.log.error({ err: appError.cause ?? appError, code: appError.code }, "request failed");
  } else {
    request.log.warn({ code: appError.code }, "request rejected");
  }
  if (appError.retryable && appError.status === 503) reply.header("retry-after", "5");
  return reply
    .status(appError.status)
    .send(errorEnvelope(appError.code, appError.publicMessage, request.id, appError.details));
});
```

Rules:

- A `ZodError` becomes `400` with `field` + `reason` details only. The Zod
  message may quote the received value, and the received value may be a
  secret a client sent to the wrong field -- so it is not echoed.
- An unknown error yields a generic message. Never `err.message`, which may
  carry a connection string, a bucket name, or a SQL fragment.
- The log line carries what the response omits, joined by `request_id`.
- A 4xx is logged at `warn` (or not at all, for expected 404s on the
  delivery path -- see `docs/OBSERVABILITY/`); only a 5xx is `error`. Logging
  every client mistake at `error` makes the error log useless within a week.

## The security rules inside error handling

These are not stylistic. Each one is a finding in
`docs/SECURITY/` if violated:

1. **A foreign-tenant resource returns `404`, with the same code and the
   same message as a genuinely absent one.** A `403` -- or a different
   message, or a different `details` array, or a measurably different
   response time -- confirms the id exists
   (`docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`).
2. **Authentication failures do not distinguish causes.** "No such API key"
   and "wrong secret" are both `api_key_invalid`. Comparison is
   constant-time (ADR-006).
3. **Signed-URL failures distinguish only what the protocol requires.**
   `signature_invalid` versus `signature_expired` is permitted by
   `docs/IMAGE-DELIVERY-PROTOCOL/24-ERROR-AND-FALLBACK.md`, because an expiry is not a secret;
   nothing further is revealed.
4. **No error message contains a secret, a raw token, a signature, a
   presigned URL, an internal hostname, a stack, or SQL.** Enforced by a
   test that throws each error class with a secret in `cause` and asserts
   the serialized response does not contain it.
5. **No error response reflects unsanitized input back to the client.** A
   `details` entry names the field and a reason from a fixed vocabulary, not
   the received value.

## Delivery-path errors

The delivery endpoint returns image bytes, not JSON, so it is the one
exception to the envelope (section 13). It follows
`docs/IMAGE-DELIVERY-PROTOCOL/25-IMAGE-HEAD-REQUEST.md` through `29-ETAG-AND-CONDITIONAL-REQUESTS.md`:

- Status codes and headers are the contract; a JSON body is advisory.
- A cache-relevant error (404, 410) carries an explicit `Cache-Control` so
  the edge does not store a miss forever, nor re-ask the origin on every
  request.
- A transformation failure MUST NOT fall back silently to serving the
  original -- a consumer receiving unexpected dimensions is worse than a
  visible error, and it would poison the cache under the derivative's key.

## Acceptance Criteria

- [x] Every field of `AppError` is justified by a named consumer.
- [x] The five security rules inside error handling are stated with the
      document that makes each one binding, and each is testable.
- [x] Status-code choice and `retryable` are specified independently, so a
      429 rate limit and a 429 quota behave differently in an SDK.

## Open Questions

- The exact envelope is ratified into `docs/API/01-API-STANDARDS.md` and
  `docs/API/05-ERROR-HANDLING.md` by `P0-09`. If those choose a different
  shape (for example an RFC 9457 `type` URI), this document follows them,
  not the other way around.
- Whether `details` uses a closed vocabulary of `reason` values or free
  strings is decided in `P0-09`; a closed vocabulary is recommended here,
  since SDKs will otherwise branch on prose.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (sections 12, 13)
- `docs/API/01-API-STANDARDS.md`, `docs/API/05-ERROR-HANDLING.md` (normative)
- `docs/DEVELOPER/10-ERRORS.md` (the consumer-facing code catalogue)
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/25-IMAGE-HEAD-REQUEST.md` through `29-ETAG-AND-CONDITIONAL-REQUESTS.md` (delivery-path HTTP semantics)
- `TASKS/PHASE-0-FOUNDATION.md` (`P0-09` ratifies the envelope)
