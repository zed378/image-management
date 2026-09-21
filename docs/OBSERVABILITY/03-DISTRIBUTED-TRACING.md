# 03 - Distributed Tracing

> Category: **Observability** (`docs/OBSERVABILITY/`) &nbsp;|&nbsp; Status: Final (v1 -- propagation; span export arrives in P7-03) &nbsp;|&nbsp; Owner: TBD

## Purpose

How one causal chain -- an upload, the derivative it triggers, the webhook it
fires -- is followed across `api`, the queue, and `worker`.

## Category Mandate

Logging, metrics, and tracing across every service boundary.

---

## The identifier

**W3C Trace Context.** The `traceparent` header:

```
traceparent: 00-<32 hex trace-id>-<16 hex span-id>-<2 hex flags>
```

Implemented in `packages/logger/src/trace-context.ts`:

| Function | Does |
|---|---|
| `parseTraceparent(header)` | Validates and parses; returns `null` for anything malformed, including the all-zero ids the spec declares invalid |
| `continueOrStartTrace(header)` | A child span of the incoming trace, or a new root trace when there is no valid header |
| `childSpan(ctx)` | Same trace id, new span id -- one per hop |
| `formatTraceparent(ctx)` | Serializes for an outgoing call |

A malformed incoming header starts a new trace rather than propagating
attacker-controlled bytes into logs and downstream calls.

## Propagation points

| Hop | Mechanism | Introduced by |
|---|---|---|
| Client -> `api` | incoming `traceparent` header, else a new root | `P0-08` (request middleware) |
| `api` -> response | `traceparent` echoed on the response, so a client can quote it in a support request | `P0-08` |
| `api` -> queue -> `worker` | the job payload carries `trace_id` and a parent span id; the worker opens a child span | `P3-09`, `P6-04` |
| every log line | `trace_id` and `span_id` bound on the request or job child logger | `P0-05` |

Carrying the trace across the queue is the part that is easy to forget and
the part that matters most: most of this platform's slow work happens in
`worker`, after the request that caused it has already returned.

## Sampling

In v1 the trace ids exist on every request and every log line, so log-based
correlation works at 100%. Span *export* to a tracing backend (OpenTelemetry
to Jaeger or a hosted equivalent) arrives in `P7-03`, with head sampling at
a traffic-appropriate rate and 100% sampling of error responses. The wire
format does not change when that happens.

## Acceptance Criteria

- [x] The trace identifier format is a published standard, implemented and
      tested (`trace-context.test.ts`: valid parse, sampled flag, case
      normalization, eight malformed-header rejections including header
      injection, continuation, round trip).
- [x] Every propagation point is listed with the task that implements it.
- [ ] One end-to-end request visible as one connected trace across both
      deployables -- verified when the request middleware exists (`P0-08`)
      and fully, with export, in `P7-03`.

## Open Questions

- Tracing backend and sampling rate: `P7-03`.

## Related Documents

- `packages/logger/src/trace-context.ts`
- `docs/OBSERVABILITY/01-LOGGING.md`
- `docs/ARCHITECTURE/14-OBSERVABILITY-ARCHITECTURE.md`
- `docs/ENGINEERING/08-CACHE-QUEUE-STANDARDS.md` (job payloads carry trace ids)
