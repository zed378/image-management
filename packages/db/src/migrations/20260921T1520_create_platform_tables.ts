import { sql, type Kysely } from "kysely";

import { timestampColumns, ulidPrimaryKey, updatedAtTrigger } from "./ddl";

// P1-01: webhooks and their delivery attempts, usage and quotas, and the
// audit log. docs/DATABASE/14-17, ADR-022 points 11-13.

/** The event types a webhook can subscribe to (docs/WEBHOOK/01-05). */
const WEBHOOK_EVENTS = sql.raw(
  `array['asset.uploaded', 'asset.updated', 'asset.deleted', 'processing.completed', 'processing.failed']::text[]`,
);

/** Metered dimensions (docs/PLAN/15). Counters sum per day; gauges hold the day's closing value. */
const METRICS = sql.raw(
  `('storage_bytes', 'bandwidth_bytes', 'transformations', 'requests', 'assets')`,
);

export const up = async (db: Kysely<unknown>): Promise<void> => {
  // ==========================================
  // WEBHOOKS
  // ==========================================
  await sql`
    create table webhooks (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      application_id char(26) not null,
      -- https is required in production by the service; the SSRF guard runs
      -- at creation and at delivery (P6-03).
      url text not null check (url ~ '^https?://' and length(url) <= 2048),
      events text[] not null check (cardinality(events) >= 1 and events <@ ${WEBHOOK_EVENTS}),
      -- AES-256-GCM envelope (ADR-022 point 13): the platform must sign with it.
      secret_ciphertext bytea not null,
      description text check (length(description) <= 500),
      status text not null default 'active' check (status in ('active', 'disabled')),
      disabled_reason text check (disabled_reason in ('manual', 'failing')),
      consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
      ${timestampColumns()},
      constraint webhooks_disabled_ck check ((status = 'disabled') = (disabled_reason is not null)),
      constraint webhooks_application_fk foreign key (application_id, tenant_id)
        references applications (id, tenant_id) on delete restrict,
      constraint webhooks_id_tenant_uk unique (id, tenant_id)
    )
  `.execute(db);
  // Serves: fan an event out to the application's live endpoints; the FK check.
  await sql`create index webhooks_application_idx on webhooks (tenant_id, application_id)`.execute(
    db,
  );
  await updatedAtTrigger("webhooks").execute(db);

  // One row per attempt (P6-04 "persist every attempt"); immutable once written.
  await sql`
    create table webhook_deliveries (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      webhook_id char(26) not null,
      -- The event's id: the same across attempts and across endpoints.
      event_id char(26) not null check (event_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
      event_type text not null check (array[event_type] <@ ${WEBHOOK_EVENTS}),
      attempt smallint not null check (attempt between 1 and 20),
      outcome text not null check (outcome in ('succeeded', 'failed', 'dead_lettered')),
      response_status smallint check (response_status between 100 and 599),
      -- A closed vocabulary (timeout, connection_refused, non_2xx, ...), never a body.
      error_code text check (error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
      duration_ms integer check (duration_ms >= 0),
      attempted_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      constraint webhook_deliveries_webhook_fk foreign key (webhook_id, tenant_id)
        references webhooks (id, tenant_id) on delete cascade,
      constraint webhook_deliveries_attempt_uk unique (webhook_id, event_id, attempt)
    )
  `.execute(db);
  // Serves: an endpoint's delivery history, newest first (dashboard, API).
  await sql`
    create index webhook_deliveries_history_idx
      on webhook_deliveries (tenant_id, webhook_id, attempted_at desc)
  `.execute(db);
  // Serves: the retention purge.
  await sql`create index webhook_deliveries_attempted_idx on webhook_deliveries (attempted_at)`.execute(
    db,
  );

  // ==========================================
  // USAGE AND QUOTAS
  // ==========================================
  // Written only by the aggregator (P1-08), never on a request path.
  await sql`
    create table usage (
      tenant_id char(26) not null,
      application_id char(26) not null,
      project_id char(26) not null,
      metric text not null check (metric in ${METRICS}),
      day date not null,
      value bigint not null default 0 check (value >= 0),
      updated_at timestamptz not null default now(),
      primary key (project_id, metric, day),
      constraint usage_project_fk foreign key (project_id, application_id, tenant_id)
        references projects (id, application_id, tenant_id) on delete restrict
    )
  `.execute(db);
  // Serves: a tenant's rollup for a period (quota checks, billing, dashboard).
  await sql`create index usage_tenant_day_idx on usage (tenant_id, day, metric)`.execute(db);
  await updatedAtTrigger("usage").execute(db);

  // Global: plan defaults, not tenant data (docs/DATABASE/00 "global").
  await sql`
    create table quotas (
      plan text not null check (plan in ('free', 'pro', 'business', 'enterprise')),
      metric text not null check (metric in ${METRICS}),
      -- null: unlimited. Counters: per calendar month (UTC). Gauges: current value.
      limit_value bigint check (limit_value >= 0),
      enforcement text not null check (enforcement in ('hard', 'soft')),
      updated_at timestamptz not null default now(),
      primary key (plan, metric)
    )
  `.execute(db);
  await updatedAtTrigger("quotas").execute(db);

  await sql`
    create table quota_overrides (
      tenant_id char(26) not null references tenants (id) on delete cascade,
      metric text not null check (metric in ${METRICS}),
      limit_value bigint check (limit_value >= 0),
      enforcement text not null check (enforcement in ('hard', 'soft')),
      reason text not null check (length(reason) between 1 and 500),
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (tenant_id, metric)
    )
  `.execute(db);
  await updatedAtTrigger("quota_overrides").execute(db);

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  // No FK to the target, application or project: the record must outlive
  // what it describes. The tenant FK stays, so a tenant cannot be dropped
  // while its audit trail exists (the purge removes it deliberately).
  await sql`
    create table audit_logs (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null references tenants (id) on delete restrict,
      actor_type text not null check (actor_type in ('user', 'api_key', 'platform_admin', 'system')),
      actor_id text check (length(actor_id) between 1 and 64),
      action text not null check (action ~ '^[a-z][a-z_]*(\\.[a-z][a-z_]*)+$' and length(action) <= 64),
      target_type text not null check (target_type ~ '^[a-z][a-z_]*$' and length(target_type) <= 64),
      target_id text check (length(target_id) between 1 and 64),
      application_id char(26),
      project_id char(26),
      request_id char(26),
      ip inet,
      metadata jsonb not null default '{}'::jsonb
        check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192),
      created_at timestamptz not null default now(),
      constraint audit_logs_actor_ck check (actor_type = 'system' or actor_id is not null)
    )
  `.execute(db);
  // Serves: a tenant's audit trail, newest first, cursor-paginated.
  await sql`create index audit_logs_tenant_idx on audit_logs (tenant_id, created_at desc, id desc)`.execute(
    db,
  );
  // Serves: the history of one object ("who changed this key").
  await sql`
    create index audit_logs_target_idx
      on audit_logs (tenant_id, target_type, target_id, created_at desc)
  `.execute(db);
  // Serves: the retention purge.
  await sql`create index audit_logs_created_idx on audit_logs (created_at)`.execute(db);

  // Append-only in the database itself, not only by grant (ADR-022 point 12):
  // UPDATE never; DELETE and TRUNCATE only inside the retention job, which
  // sets image_delivery.audit_purge = 'on' for its own transaction.
  await sql`
    create function audit_logs_guard() returns trigger language plpgsql as $$
    begin
      if tg_op = 'UPDATE' then
        raise exception 'audit_logs is append-only' using errcode = '42501';
      end if;
      if coalesce(current_setting('image_delivery.audit_purge', true), '') <> 'on' then
        raise exception 'audit_logs rows are removed only by the retention purge'
          using errcode = '42501';
      end if;
      return case when tg_op = 'DELETE' then old else null end;
    end
    $$
  `.execute(db);
  await sql`
    create trigger audit_logs_guard_rows before update or delete on audit_logs
      for each row execute function audit_logs_guard()
  `.execute(db);
  await sql`
    create trigger audit_logs_guard_truncate before truncate on audit_logs
      for each statement execute function audit_logs_guard()
  `.execute(db);
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`drop table audit_logs`.execute(db);
  await sql`drop function audit_logs_guard()`.execute(db);
  await sql`drop table quota_overrides`.execute(db);
  await sql`drop table quotas`.execute(db);
  await sql`drop table usage`.execute(db);
  await sql`drop table webhook_deliveries`.execute(db);
  await sql`drop table webhooks`.execute(db);
};
