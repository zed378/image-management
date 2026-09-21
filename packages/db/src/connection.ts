import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import type { Database } from "./types";

// int8 (bigint) columns -- byte sizes, usage counters -- arrive from pg as
// strings by default. Every such value on this platform fits well inside
// Number.MAX_SAFE_INTEGER (2^53, ~9 PB), so parse them as numbers once, here.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10));

export type DbOptions = {
  readonly url: string;
  readonly poolMax: number;
  readonly statementTimeoutMs: number;
  /** Shows up in pg_stat_activity, so an operator can tell api from worker. */
  readonly applicationName: string;
};

export type Db = Kysely<Database>;

/**
 * The only way to obtain a database handle. Every connection gets a
 * statement timeout, so no query -- however badly planned -- can hold a pool
 * connection until the pool starves (docs/ENGINEERING/07).
 */
export const createDb = (options: DbOptions): Db => {
  const pool = new pg.Pool({
    connectionString: options.url,
    max: options.poolMax,
    statement_timeout: options.statementTimeoutMs,
    application_name: options.applicationName,
    // Fail fast rather than queue forever when the database is unreachable;
    // /readyz depends on this surfacing as an error.
    connectionTimeoutMillis: 5_000,
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
};
