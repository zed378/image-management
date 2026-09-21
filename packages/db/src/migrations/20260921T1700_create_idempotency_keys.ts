import { sql, type Kysely } from "kysely";

// P2-02: idempotent creates (docs/API/08-IDEMPOTENCY.md, ADR-022 point 10).
// One row per (tenant, project, Idempotency-Key): the first request claims
// it `in_progress`; its outcome is stored when it completes; a retry with
// the same key and the same request replays that outcome, a retry with a
// different request is refused. Rows expire after 24 hours
// (docs/DATABASE/18).

export const up = async (db: Kysely<unknown>): Promise<void> => {
  await sql`
    create table idempotency_keys (
      tenant_id char(26) not null,
      project_id char(26) not null,
      key text not null check (length(key) between 1 and 255 and key !~ '[[:cntrl:]]'),
      -- SHA-256 of the request's method, route and body: the same key with a
      -- different request is a client bug, answered 409.
      request_hash char(64) not null check (request_hash ~ '^[0-9a-f]{64}$'),
      status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
      response_status smallint check (response_status between 200 and 599),
      response_body jsonb,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      primary key (tenant_id, project_id, key),
      constraint idempotency_keys_completed_ck check (
        status <> 'completed' or (response_status is not null and response_body is not null)
      ),
      constraint idempotency_keys_project_fk foreign key (project_id, tenant_id)
        references projects (id, tenant_id) on delete cascade
    )
  `.execute(db);
  // Serves: the expiry sweep.
  await sql`create index idempotency_keys_expires_idx on idempotency_keys (expires_at)`.execute(db);
  // Serves: the project FK's cascade.
  await sql`create index idempotency_keys_project_idx on idempotency_keys (project_id, tenant_id)`.execute(
    db,
  );
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`drop table idempotency_keys`.execute(db);
};
