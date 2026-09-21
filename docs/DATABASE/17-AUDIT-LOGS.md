# 17 - Audit Logs

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

An append-only record of security-relevant actions: who did what, to what,
when, from where. It must be queryable per tenant, outlive log rotation, and
be impossible to rewrite from the application.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:audit_logs -->
Table `audit_logs` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `actor_type` | `text` | no |  |
| `actor_id` | `text` | yes |  |
| `action` | `text` | no |  |
| `target_type` | `text` | no |  |
| `target_id` | `text` | yes |  |
| `application_id` | `character(26)` | yes |  |
| `project_id` | `character(26)` | yes |  |
| `request_id` | `character(26)` | yes |  |
| `ip` | `inet` | yes |  |
| `metadata` | `jsonb` | no | `'{}'::jsonb` |
| `created_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `audit_logs_action_check`: `CHECK (((action ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'::text) AND (length(action) <= 64)))`
- `audit_logs_actor_ck`: `CHECK (((actor_type = 'system'::text) OR (actor_id IS NOT NULL)))`
- `audit_logs_actor_id_check`: `CHECK (((length(actor_id) >= 1) AND (length(actor_id) <= 64)))`
- `audit_logs_actor_type_check`: `CHECK ((actor_type = ANY (ARRAY['user'::text, 'api_key'::text, 'platform_admin'::text, 'system'::text])))`
- `audit_logs_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `audit_logs_metadata_check`: `CHECK (((jsonb_typeof(metadata) = 'object'::text) AND (pg_column_size(metadata) <= 8192)))`
- `audit_logs_target_id_check`: `CHECK (((length(target_id) >= 1) AND (length(target_id) <= 64)))`
- `audit_logs_target_type_check`: `CHECK (((target_type ~ '^[a-z][a-z_]*$'::text) AND (length(target_type) <= 64)))`
- `audit_logs_tenant_id_fkey`: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`
- `audit_logs_pkey`: `PRIMARY KEY (id)`

Indexes:

- `audit_logs_created_idx`: `(created_at)`
- `audit_logs_target_idx`: `(tenant_id, target_type, target_id, created_at DESC)`
- `audit_logs_tenant_idx`: `(tenant_id, created_at DESC, id DESC)`
<!-- /schema:audit_logs -->

## Columns that need explaining

| Column | Meaning |
|---|---|
| `actor_type`, `actor_id` | `user` / `api_key` (id), `platform_admin` (operator identity), or `system` (no id). An operator's action on a tenant is recorded **under that tenant**, so the tenant can see it. |
| `action` | Dotted, lower-case: `api_key.created`, `role.granted`, `asset.purged`. The vocabulary is `P1-07`'s; the database enforces the shape. |
| `target_type`, `target_id` | What was acted on. Deliberately **no foreign key**: the record must outlive its target. |
| `application_id`, `project_id`, `request_id`, `ip` | Context for investigation; `request_id` joins the log to the request's log lines. |
| `metadata` | A JSON object, at most 8 KB. Never a secret, never a credential (`docs/ENGINEERING/12`). |

## Append-only, enforced by the database

A trigger (`audit_logs_guard`) rejects every `UPDATE`, and rejects `DELETE`
and `TRUNCATE` unless the transaction has set
`image_delivery.audit_purge = 'on'` -- which only the retention job does,
for its own transaction (`set_config(..., true)`). This holds even for a
connection with full table privileges; the application role additionally
has no `UPDATE`/`DELETE` grant (`P1-07`, `docs/DEVOPS/04`).

## Query patterns and indexes

| Query | Index |
|---|---|
| A tenant's trail, newest first | `audit_logs_tenant_idx (tenant_id, created_at desc, id desc)` |
| One object's history | `audit_logs_target_idx (tenant_id, target_type, target_id, created_at desc)` |
| Retention purge | `audit_logs_created_idx (created_at)` |

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] UPDATE, DELETE and TRUNCATE are refused, and the purge path works only
      inside its transaction (tested).

## Related Documents

- `docs/SECURITY/17-AUDIT-LOGGING.md`, `docs/SECURITY/00` (`SEC-SEC-04`)
- `docs/DATABASE/18-DATA-RETENTION.md`
- `MEMORY/DECISIONS.md` (`ADR-022` point 12)
