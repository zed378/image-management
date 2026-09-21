# 14 - Usage

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Time-bucketed usage per project, written only by the asynchronous
aggregator (`P1-08`) -- never computed on a request path. Quota checks,
the dashboard and billing read rollups of it.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:usage -->
Table `usage` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `tenant_id` | `character(26)` | no |  |
| `application_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `metric` | `text` | no |  |
| `day` | `date` | no |  |
| `value` | `bigint` | no | `0` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `usage_metric_check`: `CHECK ((metric = ANY (ARRAY['storage_bytes'::text, 'bandwidth_bytes'::text, 'transformations'::text, 'requests'::text, 'assets'::text])))`
- `usage_value_check`: `CHECK ((value >= 0))`
- `usage_project_fk`: `FOREIGN KEY (project_id, application_id, tenant_id) REFERENCES projects(id, application_id, tenant_id) ON DELETE RESTRICT`
- `usage_pkey`: `PRIMARY KEY (project_id, metric, day)`

Indexes:

- `usage_tenant_day_idx`: `(tenant_id, day, metric)`
<!-- /schema:usage -->

<!-- schema:usage_event_ledger -->
Table `usage_event_ledger` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `event_id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `applied_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `usage_event_ledger_event_id_check`: `CHECK ((event_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `usage_event_ledger_tenant_id_fkey`: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`
- `usage_event_ledger_pkey`: `PRIMARY KEY (event_id)`

Indexes:

- `usage_event_ledger_applied_idx`: `(applied_at)`
- `usage_event_ledger_tenant_idx`: `(tenant_id)`
<!-- /schema:usage_event_ledger -->

`usage_event_ledger` makes applying an event exactly-once: the aggregator
inserts the event id and adds to `usage` in one transaction, only if the
insert happened (`P1-08`). Kept 30 days (`18-DATA-RETENTION.md`).

## Model

- **Bucket**: one UTC calendar day (`day`, returned as the string
  `YYYY-MM-DD`; `packages/db` parses `date` as a string so a server time zone
  cannot shift it).
- **Grain**: one row per `(project_id, metric, day)` -- the primary key, so
  the aggregator's write is an idempotent upsert.
- `tenant_id` and `application_id` are denormalized for rollups and
  FK-checked against the project (`usage_project_fk`), so they cannot drift.

| Metric | Kind | `value` means |
|---|---|---|
| `requests` | counter | API and delivery requests that day |
| `bandwidth_bytes` | counter | bytes delivered that day |
| `transformations` | counter | derivatives generated that day |
| `storage_bytes` | gauge | bytes stored at the end of the day (originals + derivatives) |
| `assets` | gauge | live assets at the end of the day |

A month's counter is the sum of its days; a month's gauge is its latest day
(for quota) or its maximum (for billing, `docs/PLAN/17`).

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] The day is returned as a calendar day regardless of time zone (tested).

## Related Documents

- `docs/DATABASE/15-QUOTAS.md`
- `docs/PLAN/15-QUOTA-LIMITS.md`
- `docs/DATABASE/18-DATA-RETENTION.md`
