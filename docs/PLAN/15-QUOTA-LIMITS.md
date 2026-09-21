# 15 - Quota & Limits

> Category: **Product & Plan** (`docs/PLAN/`) &nbsp;|&nbsp; Status: Final (v1 -- the metrics and behaviors; the numbers per plan come from PLAN/17) &nbsp;|&nbsp; Owner: TBD

## Purpose

What the platform meters, at what scope, and what happens when a limit is
reached. Metering exists from `P1-08`; enforcement lands in `P7-04`. The
per-plan numbers are business decisions made in
[`17-PRICING-ENTITLEMENT.md`](./17-PRICING-ENTITLEMENT.md) and stored as data
(`quotas`, `quota_overrides`) -- never in code.

## Category Mandate

Defines what the platform is, who it is for, and what it must do before any
code is written. Everything under PLAN/ is product intent: requirements,
scope, business rules, and the roadmap. Architecture and API documents
implement what PLAN/ decides; they must not silently redefine it.

---

## Metrics

| Metric | Unit | Kind | Measured by | Limit period |
|---|---|---|---|---|
| `requests` | API and delivery requests | counter | usage events from the api/delivery tier | calendar month (UTC) |
| `bandwidth_bytes` | bytes served to clients | counter | usage events from the delivery tier | calendar month (UTC) |
| `transformations` | derivatives generated (not served from cache) | counter | usage events from the worker | calendar month (UTC) |
| `storage_bytes` | bytes stored (originals + derivatives) | gauge | recomputed from `asset_versions` / `image_derivatives` | current value |
| `assets` | live assets | gauge | recomputed from `assets` | current value |

Counters arrive as batched events on the `usage-metering` queue and are
applied exactly once (`docs/DATABASE/14`); gauges are recomputed by the
`recompute-usage` maintenance job, so they are correct even if an event is
lost.

## Scope

- Usage is recorded **per project, per UTC day**. Tenant and application
  totals are sums over their projects (the `usage` table carries both ids).
- Limits apply **per tenant**: a tenant's plan (or its override) caps the
  sum over all its applications and projects. Per-project limits are not in
  v1.

## When a limit is reached

| Enforcement | Applies to | Behavior |
|---|---|---|
| **hard** | `storage_bytes`, `assets` (a new upload), `transformations` | The request that would exceed the limit is refused: `429 quota_exceeded`, `retryable: false`, with the metric in `details`. Existing assets keep being served. |
| **hard, degrade** | `bandwidth_bytes`, `requests` on delivery | Delivery is never cut off for a paying tenant mid-month: over the limit, originals and already-generated derivatives keep being served, new transformations are refused (`429`), and the tenant is notified. |
| **soft** | any metric, per plan | Served normally; the tenant is notified at 80% and 100%, and the overage is reported for billing. |

Which metric is hard or soft on which plan is the `enforcement` column of
`quotas` / `quota_overrides`. Nothing is ever queued for later because of a
quota: a caller gets an answer now.

Notifications fire at 80% and 100% of a limit, once per period per metric.
Quota checks read a cached rollup, never `usage` on the request path
(`P7-04`, `docs/ENGINEERING/08`).

## Acceptance Criteria

- [x] Every metric is defined with its unit, kind, source and period.
- [x] Scope and over-limit behavior are stated for every metric.
- [ ] Per-plan numbers and hard/soft choice per plan: `PLAN/17`
      (business input).

## Related Documents

- `docs/DATABASE/14-USAGE.md`, `15-QUOTAS.md`
- `docs/PLAN/17-PRICING-ENTITLEMENT.md`
- `docs/API/05-ERROR-HANDLING.md` (`quota_exceeded`)
