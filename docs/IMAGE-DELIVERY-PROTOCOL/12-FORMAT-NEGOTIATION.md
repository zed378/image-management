# 12 - Format Negotiation

> Category: **Image Delivery Protocol** (`docs/IMAGE-DELIVERY-PROTOCOL/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Define `f=` including the `auto` negotiation mode -- the protocol's primary
bandwidth-optimization lever -- and the **progressive format upgrade** that
keeps format selection off the critical path (`ADR-015`, `ADR-016`).

## Category Mandate

This is the platform's primary contract, on equal footing with API/.
`API/13-IMAGE-TRANSFORMATION-API.md` defers to this category as the
normative source.

---

## The governing rule

> **`f=auto` may degrade. An explicit `f=` never degrades.**

`auto` delegates the choice to the platform, so the platform is free to
choose a cheaper format when the preferred one is not yet available. That is
a decision `auto` licenses, not a failure to honour the request -- provided
it is specified, which is what this document does.

An explicit `f=avif` is a caller who knows what they want. It is generated
synchronously and served, or it fails. It is never silently substituted and
never subject to the size guard below.

Everything below follows from that one asymmetry.

---

## Part 1 -- Negotiation

### Explicit values

`jpeg`, `png`, `webp`, `avif`. Honoured exactly, no negotiation, regardless
of `Accept`. A client asking for a format its own `Accept` header excludes
still receives it; that is the caller's business.

### `f=auto` (the default)

Negotiated from the request's `Accept` header in the order AVIF, WebP, JPEG
(`ADR-008`).

### The `Accept` bucket

The raw `Accept` header **never** reaches a cache key. Real-world `Accept`
values are numerous enough to fragment an edge cache badly for no benefit,
so the header collapses first to exactly one of three buckets
(`ADR-014`):

| `Accept` contains | Bucket | Resolved format |
|---|---|---|
| `image/avif` | `avif` | `avif` |
| `image/webp`, not `image/avif` | `webp` | `webp` |
| neither | `jpeg` | `jpeg` |

The **resolved concrete format**, not the string `auto`, enters
`params_hash` (`03-TRANSFORMATION-URL-SPECIFICATION.md`, step 9). Two
requests for the same URL from clients in different buckets are therefore
legitimately two derivatives.

### `Vary`

Every response to a request that used negotiation carries:

```
Vary: Accept
```

The origin varies on the *bucket*; the header names `Accept` because that is
what an HTTP cache understands. The CDN's cache key MUST use the bucket
(`docs/CDN/01-CACHE-KEY.md`, `P4-02`) -- a cache configured to vary on the
raw header is a misconfiguration, not a conservative choice.

A response to an explicit `f=` does **not** carry `Vary: Accept`; nothing
about it depends on the header.

---

## Part 2 -- Progressive format upgrade

### Why

Not for the reason first assumed. AVIF encoding was expected to be too
expensive for the request path; measurement showed otherwise -- at
`effort: 1` it is cheaper than both JPEG and WebP on photographic content
(`docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md`, `ADR-016`).

The actual reason is the **size guard**. AVIF is not universally smaller: on
high-frequency content it measured nearly three times larger than JPEG. So
`f=auto` cannot simply mean "AVIF whenever the client accepts it" without
sometimes delivering a bigger file than necessary. Deciding which format
actually wins requires encoding more than one candidate and comparing the
outputs -- and that is plainly not request-path work.

"Fully asynchronous" is not available as an answer either: the delivery path
is called by an `<img>` element, which needs bytes now. There is no `202` to
return. The real question is therefore not *synchronous or asynchronous* but
**what is served while the winning format is not yet known**.

Burst absorption -- a catalog import producing tens of thousands of cold
derivatives at once -- remains a genuine secondary benefit of routing this
through the queue (`ADR-007`).

### The state machine

For a request where the resolved format is `avif` and `f` was `auto`:

```
resolved format = avif, from f=auto
  │
  ├── AVIF derivative exists
  │      └─> serve it.  Cache-Control: public, max-age=31536000, immutable
  │
  ├── AVIF marked permanently unavailable for this derivative
  │      └─> serve the fallback format.
  │          Cache-Control: public, max-age=31536000, immutable
  │          X-Image-Format-Fallback: avif-unavailable
  │
  ├── AVIF marked not beneficial for this derivative (ADR-016 size guard:
  │   the AVIF candidate came out no smaller than the cheaper one)
  │      └─> serve the smaller format.
  │          Cache-Control: public, max-age=31536000, immutable
  │          X-Image-Format-Fallback: avif-not-beneficial
  │
  └── AVIF absent
         ├─> enqueue generate-derivative(format=avif) AND the size-guard
         │   comparison against the cheaper candidate (ADR-016)
         │      jobId = <assetVersionId>:<paramsHash>   (single-flight)
         ├─> ensure the fallback derivative exists (generate it now if not;
         │   it is the cheap encode)
         └─> serve the fallback format.
             Cache-Control: public, max-age=60, stale-while-revalidate=300
             X-Image-Format-Fallback: avif-pending
```

### The fallback format

The **cheapest format the client accepts**, in order:

1. `webp` -- if the client's `Accept` includes it. Chosen over JPEG because
   WebP encoding is inexpensive, the output is substantially smaller than
   JPEG, and support is effectively universal among clients that advertise
   AVIF.
2. `jpeg` -- for the rare client that advertises AVIF but not WebP.

The fallback never applies when the resolved format is already `webp` or
`jpeg`; those are the cheap encodes and run synchronously.

### Identity and storage

The rule that keeps this coherent, and the part that is easy to get wrong:

- The request's `params_hash` is **unchanged** by the fallback. It is the
  hash of the AVIF derivative, because that is what `f=auto` resolved to.
- The fallback bytes are stored under **their own** object key -- the WebP
  derivative's key, with the WebP `params_hash`. That is a legitimate
  derivative in its own right, one another client may request directly.
- Nothing is ever written under the AVIF key except AVIF bytes. Storing the
  fallback there would corrupt derivative identity and silently poison the
  cache for every future request (`ADR-004`).

So what is short-lived is **only the edge's cached response** for the AVIF
bucket, never a stored object. During the fallback window that response
holds WebP bytes under the AVIF bucket's cache key, with a 60-second TTL.
That is deliberate and specified here so that a future reader does not
diagnose it as a bug.

Consequence to accept: a project whose clients are overwhelmingly
AVIF-capable will accumulate WebP derivatives that are rarely requested
again. They are small and cheap to produce; this is the price of the
mechanism and it is a good trade.

### The size guard

The AVIF generation job does not only encode AVIF. It encodes the AVIF
candidate and compares its output size against the cheaper candidate at the
same quality tier. If AVIF is not smaller, the derivative is marked
`avif_not_beneficial`, the format decision flips to the smaller candidate,
and that decision is **persisted per derivative** so `f=auto` resolution is
deterministic from then on.

This is not a hypothetical. Measured at w=1280 on high-frequency content:
JPEG 261 KiB, WebP 408 KiB, AVIF 769 KiB (`ADR-016`). Without the guard the
platform would knowingly deliver the largest of the three while also paying
the most to produce it -- on a product whose central claim is bandwidth.

An explicit `f=avif` is **not** subject to the guard. The caller asked for
AVIF; they get AVIF, whatever its size. Same asymmetry as everything else in
this document.

### Encoder settings

Both encoders run at deliberately low effort, and never at the library
default (`ADR-016`):

| Format | Setting | Library default | Why |
|---|---|---|---|
| AVIF | `effort: 1` | 4 | Effort 4 measured 10x the cost for at most 1 KiB |
| WebP | `effort: 2` | 4 | Same cliff, same conclusion |

These values belong to the versioned encoder-settings table that
participates in `params_hash` (`ADR-014`): changing `effort` changes the
bytes returned for an identical URL, so it is a versioned change, not a
configuration tweak.

### Permanent failure

When the AVIF job fails in a way that will not succeed on retry -- an input
the encoder cannot handle, a decode failure, an image outside the encoder's
supported bounds -- the derivative record is marked `avif_unavailable` and
the fallback becomes the final answer, served with the **full immutable
TTL**.

Without this, every request re-enqueues a job that is certain to fail, the
short TTL never lifts, and the platform pays revalidation and queue cost
forever on an image that will never be AVIF. Failure classification follows
`docs/IMAGE-PROCESSING/16-PROCESSING-FAILURE.md` and the `retryable` flag on
`AppError` (`docs/ENGINEERING/06-ERROR-RESPONSE-STANDARDS.md`).

### Backlog behaviour

If the queue is behind, the 60-second TTL expires while AVIF is still
pending and the request arrives again. Two mechanisms keep that from
compounding:

- the deterministic `jobId` deduplicates the re-enqueue
  (`docs/ENGINEERING/08-CACHE-QUEUE-STANDARDS.md`);
- the fallback TTL backs off on repeated pending misses for the same
  derivative -- 60s, then 300s, then 1800s -- so a long backlog degrades
  into "serving WebP efficiently" rather than "revalidating constantly".

### Eager generation makes most of this unnecessary

When a project enables the dimension ladder (`ADR-014`), the set of
derivatives per asset version becomes finite and small. At that point AVIF
for the ladder's widths can be generated eagerly at upload time, in the
queue, where the person waiting is the uploader rather than a visitor.

Cold AVIF requests then become rare, and the progressive upgrade is a safety
net for arbitrary widths rather than the common path. This is a second
reason to enable the ladder beyond cardinality control, and `P3-07` owns it.

The ladder remains **off by default** (`ADR-014`) -- this does not reverse
that decision. It means enabling the ladder buys two things at once.

---

## Part 3 -- Observability

`format_fallback_ratio` -- the share of `f=auto` AVIF-bucket responses
served as a fallback -- is an **SLI**, not a debug counter
(`docs/OBSERVABILITY/`). A sustained high value means eager generation is
not keeping up, or the queue is under-provisioned, and the symptom is
otherwise invisible: every request succeeds, the pages just weigh more than
they should.

`X-Image-Format-Fallback` is emitted with values `avif-pending` or
`avif-unavailable`. Whether it is exposed in production or only behind a
debug flag is a `P4-01` decision, since it is a header on a cacheable
response (same open question as `X-Image-Ignored-Params`).

---

## Reference example

```
Consumer
   |
   | Accept: image/avif,image/webp,image/jpeg
   v
Image Platform
   |
   +-- bucket = avif, f=auto resolves to avif
   |
   +-- AVIF derivative present?
   |      yes -> serve AVIF, immutable
   |      no  -> enqueue AVIF; serve WebP, max-age=60, X-Image-Format-Fallback: avif-pending
   |
   +-- explicit f=avif instead?
          -> generate AVIF synchronously at full effort, or fail. Never WebP.
```

`f=auto` is the default; an explicit `f=` overrides negotiation entirely.

## Acceptance Criteria

- [x] Explicit and negotiated behaviour are separated by one stated rule,
      and the asymmetry is justified rather than asserted.
- [x] The `Accept` bucket is required before any cache key, with the
      fragmentation failure it prevents named.
- [x] `Vary: Accept` is required for negotiated responses and forbidden for
      explicit ones.
- [x] The progressive upgrade is specified as a state machine with an
      explicit `Cache-Control` per state.
- [x] Storage identity is specified: the fallback never occupies the AVIF
      key, and `params_hash` is unaffected.
- [x] Permanent failure and queue backlog both have specified behaviour, so
      neither degrades into unbounded retry.
- [x] Every state is covered by a conformance test in `37-PROTOCOL-TESTING.md`:
      cold `f=auto` serves fallback and enqueues; warm serves AVIF immutable;
      explicit `f=avif` never falls back and is exempt from the size guard;
      permanent failure serves fallback immutably without re-enqueueing;
      a derivative marked `avif_not_beneficial` serves the smaller format
      immutably; an AVIF-only `Accept` falls back to JPEG; `params_hash` is
      identical in the cold and warm cases.

## Open Questions

- The 60-second initial fallback TTL and the 60/300/1800 backoff are
  starting values, not measured ones. `P4-03` should tune them against the
  real p95 AVIF queue latency from `P3-09`: the TTL wants to be a little
  longer than the time it actually takes to produce the AVIF, and shorter
  than that wastes revalidation while longer delays the upgrade.
- Whether `X-Image-Format-Fallback` ships in production responses (`P4-01`).
- Whether a project can opt out of progressive upgrade and demand
  synchronous AVIF for `f=auto` as well. There is a plausible case (a
  customer who would rather have a slow first request than a heavier one)
  but it doubles the number of delivery-path behaviours to test, so the
  default answer is no unless a real customer asks.
- `q=auto` resolution interacts with this: the versioned quality table is
  per-format, so the fallback's quality comes from the WebP row, not the
  AVIF row. Confirm in `P3-05` that the two are looked up independently.

## Related Documents

- `docs/IMAGE-DELIVERY-PROTOCOL/README.md` (category index)
- `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md` (step 9, the Accept bucket)
- `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md` (the `f` and `q` rows)
- `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/19-CACHE-CONTROL.md` (TTL policy), `24-ERROR-AND-FALLBACK.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/37-PROTOCOL-TESTING.md` (the conformance cases above)
- `docs/IMAGE-PROCESSING/10-FORMAT-CONVERSION.md`, `16-PROCESSING-FAILURE.md`
- `docs/CDN/01-CACHE-KEY.md`, `docs/CDN/04-CACHE-TTL.md`, `docs/CDN/02-CACHE-CONTROL.md`
- `docs/ENGINEERING/08-CACHE-QUEUE-STANDARDS.md` (job idempotency and DLQ)
- `docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md` (the encode cost that motivates this)
- `MEMORY/DECISIONS.md` (`ADR-004`, `ADR-007`, `ADR-008`, `ADR-014`, `ADR-015`)
