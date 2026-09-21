import { sql, type Kysely } from "kysely";

// P1-08: exactly-once application of usage events. Queue delivery is
// at-least-once (docs/ENGINEERING/08 "Idempotency"); the aggregator inserts
// the event id here and adds the amount to `usage` in the same transaction
// only if the insert happened. A redelivered event finds its id and adds
// nothing -- layer 3 of the idempotency rule, the one that does not race.
//
// Rows are kept for 30 days (docs/DATABASE/18), far longer than any job can
// stay in the queue.

export const up = async (db: Kysely<unknown>): Promise<void> => {
  await sql`
    create table usage_event_ledger (
      event_id char(26) primary key check (event_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
      tenant_id char(26) not null references tenants (id) on delete cascade,
      applied_at timestamptz not null default now()
    )
  `.execute(db);
  // Serves: the retention purge.
  await sql`create index usage_event_ledger_applied_idx on usage_event_ledger (applied_at)`.execute(
    db,
  );
  // Serves: the tenant FK's cascade on tenant purge.
  await sql`create index usage_event_ledger_tenant_idx on usage_event_ledger (tenant_id)`.execute(
    db,
  );
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`drop table usage_event_ledger`.execute(db);
};
