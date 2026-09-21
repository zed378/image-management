# 15 - Quotas

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The limits usage is checked against. `quotas` holds the default limit per
plan and metric and is **global** (reference data, not tenant data);
`quota_overrides` holds a tenant's exceptions. The numbers are data, set by
`P7-04` from `docs/PLAN/17` -- no limit is written in a migration.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:quotas -->
Table `quotas` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `plan` | `text` | no |  |
| `metric` | `text` | no |  |
| `limit_value` | `bigint` | yes |  |
| `enforcement` | `text` | no |  |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `quotas_enforcement_check`: `CHECK ((enforcement = ANY (ARRAY['hard'::text, 'soft'::text])))`
- `quotas_limit_value_check`: `CHECK ((limit_value >= 0))`
- `quotas_metric_check`: `CHECK ((metric = ANY (ARRAY['storage_bytes'::text, 'bandwidth_bytes'::text, 'transformations'::text, 'requests'::text, 'assets'::text])))`
- `quotas_plan_check`: `CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'business'::text, 'enterprise'::text])))`
- `quotas_pkey`: `PRIMARY KEY (plan, metric)`
<!-- /schema:quotas -->

<!-- schema:quota_overrides -->
Table `quota_overrides` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `tenant_id` | `character(26)` | no |  |
| `metric` | `text` | no |  |
| `limit_value` | `bigint` | yes |  |
| `enforcement` | `text` | no |  |
| `reason` | `text` | no |  |
| `expires_at` | `timestamp with time zone` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `quota_overrides_enforcement_check`: `CHECK ((enforcement = ANY (ARRAY['hard'::text, 'soft'::text])))`
- `quota_overrides_limit_value_check`: `CHECK ((limit_value >= 0))`
- `quota_overrides_metric_check`: `CHECK ((metric = ANY (ARRAY['storage_bytes'::text, 'bandwidth_bytes'::text, 'transformations'::text, 'requests'::text, 'assets'::text])))`
- `quota_overrides_reason_check`: `CHECK (((length(reason) >= 1) AND (length(reason) <= 500)))`
- `quota_overrides_tenant_id_fkey`: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`
- `quota_overrides_pkey`: `PRIMARY KEY (tenant_id, metric)`
<!-- /schema:quota_overrides -->

## Semantics

- `limit_value` is in the metric's unit ([`14-USAGE.md`](./14-USAGE.md));
  `null` means unlimited.
- Counters are limited per calendar month (UTC); gauges are limited at
  their current value.
- `enforcement`: `hard` -- the request is refused with `429 quota_exceeded`,
  not retryable until the period resets (`docs/API/05`); `soft` -- served,
  flagged, and notified.
- The effective limit for a tenant is its override if one exists and has
  not expired (`expires_at`), else its plan's default.
- Every override carries a `reason`, and creating or changing one is
  audited (`P1-07`).

## Acceptance Criteria

- [x] The column tables are generated from the migrated schema and checked
      on every CI run.
- [x] `quotas` is listed as global in `docs/DATABASE/00` and in the
      migration lint's table classification.

## Related Documents

- `docs/DATABASE/14-USAGE.md`
- `docs/PLAN/15-QUOTA-LIMITS.md`, `docs/PLAN/17-PRICING-ENTITLEMENT.md`
- `MEMORY/DECISIONS.md` (`ADR-022` point 11)
