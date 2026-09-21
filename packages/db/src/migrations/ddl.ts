import { sql, type RawBuilder } from "kysely";

// Shared DDL fragments, so every table gets the same id and timestamp rules.

/** Crockford-base32 ULID check, kept in sync with packages/schema ULID_PATTERN. */
export const ULID_CHECK = "^[0-9A-HJKMNP-TV-Z]{26}$";

/** `id char(26) primary key` with the ULID shape enforced by the database. */
export const ulidPrimaryKey = (): RawBuilder<unknown> =>
  sql`id char(26) primary key check (id ~ ${sql.lit(ULID_CHECK)})`;

/** created_at / updated_at / deleted_at, all timestamptz, all UTC. */
export const timestampColumns = (): RawBuilder<unknown> => sql`
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
`;

/** Keep updated_at honest without trusting every UPDATE to set it. */
export const updatedAtTrigger = (table: string): RawBuilder<unknown> =>
  sql`create trigger ${sql.id(`${table}_set_updated_at`)}
      before update on ${sql.table(table)}
      for each row execute function set_updated_at()`;
