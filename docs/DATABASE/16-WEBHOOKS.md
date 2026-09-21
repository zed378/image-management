# 16 - Webhooks

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Endpoints an application registers to receive events, and a record of every
delivery attempt to them.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:webhooks -->
Table `webhooks` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `application_id` | `character(26)` | no |  |
| `url` | `text` | no |  |
| `events` | `text[]` | no |  |
| `secret_ciphertext` | `bytea` | no |  |
| `description` | `text` | yes |  |
| `status` | `text` | no | `'active'::text` |
| `disabled_reason` | `text` | yes |  |
| `consecutive_failures` | `integer` | no | `0` |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `deleted_at` | `timestamp with time zone` | yes |  |

Constraints:

- `webhooks_consecutive_failures_check`: `CHECK ((consecutive_failures >= 0))`
- `webhooks_description_check`: `CHECK ((length(description) <= 500))`
- `webhooks_disabled_ck`: `CHECK (((status = 'disabled'::text) = (disabled_reason IS NOT NULL)))`
- `webhooks_disabled_reason_check`: `CHECK ((disabled_reason = ANY (ARRAY['manual'::text, 'failing'::text])))`
- `webhooks_events_check`: `CHECK (((cardinality(events) >= 1) AND (events <@ ARRAY['asset.uploaded'::text, 'asset.updated'::text, 'asset.deleted'::text, 'processing.completed'::text, 'processing.failed'::text])))`
- `webhooks_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `webhooks_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))`
- `webhooks_url_check`: `CHECK (((url ~ '^https?://'::text) AND (length(url) <= 2048)))`
- `webhooks_application_fk`: `FOREIGN KEY (application_id, tenant_id) REFERENCES applications(id, tenant_id) ON DELETE RESTRICT`
- `webhooks_pkey`: `PRIMARY KEY (id)`
- `webhooks_id_tenant_uk`: `UNIQUE (id, tenant_id)`

Indexes:

- `webhooks_application_idx`: `(tenant_id, application_id)`
<!-- /schema:webhooks -->

<!-- schema:webhook_deliveries -->
Table `webhook_deliveries` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `webhook_id` | `character(26)` | no |  |
| `event_id` | `character(26)` | no |  |
| `event_type` | `text` | no |  |
| `attempt` | `smallint` | no |  |
| `outcome` | `text` | no |  |
| `response_status` | `smallint` | yes |  |
| `error_code` | `text` | yes |  |
| `duration_ms` | `integer` | yes |  |
| `attempted_at` | `timestamp with time zone` | no | `now()` |
| `created_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `webhook_deliveries_attempt_check`: `CHECK (((attempt >= 1) AND (attempt <= 20)))`
- `webhook_deliveries_duration_ms_check`: `CHECK ((duration_ms >= 0))`
- `webhook_deliveries_error_code_check`: `CHECK ((error_code ~ '^[a-z][a-z0-9_]{0,63}$'::text))`
- `webhook_deliveries_event_id_check`: `CHECK ((event_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `webhook_deliveries_event_type_check`: `CHECK ((ARRAY[event_type] <@ ARRAY['asset.uploaded'::text, 'asset.updated'::text, 'asset.deleted'::text, 'processing.completed'::text, 'processing.failed'::text]))`
- `webhook_deliveries_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `webhook_deliveries_outcome_check`: `CHECK ((outcome = ANY (ARRAY['succeeded'::text, 'failed'::text, 'dead_lettered'::text])))`
- `webhook_deliveries_response_status_check`: `CHECK (((response_status >= 100) AND (response_status <= 599)))`
- `webhook_deliveries_webhook_fk`: `FOREIGN KEY (webhook_id, tenant_id) REFERENCES webhooks(id, tenant_id) ON DELETE CASCADE`
- `webhook_deliveries_pkey`: `PRIMARY KEY (id)`
- `webhook_deliveries_attempt_uk`: `UNIQUE (webhook_id, event_id, attempt)`

Indexes:

- `webhook_deliveries_attempted_idx`: `(attempted_at)`
- `webhook_deliveries_history_idx`: `(tenant_id, webhook_id, attempted_at DESC)`
<!-- /schema:webhook_deliveries -->

## Columns that need explaining

| Column | Meaning |
|---|---|
| `webhooks.events` | A non-empty subset of `asset.uploaded`, `asset.updated`, `asset.deleted`, `processing.completed`, `processing.failed` (`docs/WEBHOOK/01-05`). |
| `webhooks.secret_ciphertext` | The signing secret, **encrypted** (AES-256-GCM, key from the secret store), because the platform must sign with it; shown to the user once, at creation (ADR-022 point 13, `P6-03`). |
| `webhooks.status` / `disabled_reason` | `disabled` with `manual` or `failing` (auto-disabled after repeated failures); the reason is set exactly when disabled. |
| `webhook_deliveries` | One row per **attempt** (`P6-04`), immutable. `event_id` is the event's id, shared by every attempt and every endpoint; `outcome` is `succeeded`, `failed` (will retry) or `dead_lettered` (final failure). |
| `error_code` | A closed vocabulary (`timeout`, `connection_refused`, `non_2xx`, ...). A response body is never stored: it is the customer's data and may contain anything. |

## Invariants

- A webhook belongs to an application in its tenant; deliveries belong to a
  webhook in the same tenant (composite FKs).
- An attempt is recorded once: `unique (webhook_id, event_id, attempt)`.
- The URL passes the SSRF guard at creation and again at delivery, and is
  `https` in production (`SEC-UPL-07`, `P6-03`) -- service.

## Acceptance Criteria

- [x] The column tables are generated from the migrated schema and checked
      on every CI run.
- [x] The event vocabulary is enforced by the database (tested).

## Related Documents

- `docs/WEBHOOK/`, `docs/API/` (webhook endpoints)
- `docs/DATABASE/18-DATA-RETENTION.md`
- `MEMORY/DECISIONS.md` (`ADR-022` point 13)
