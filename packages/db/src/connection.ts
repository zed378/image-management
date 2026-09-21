import { Kysely, PostgresDialect, type Transaction } from "kysely";
import pg from "pg";

import type { Database } from "./types";

// int8 (bigint) columns -- byte sizes, usage counters -- arrive from pg as
// strings by default. Every such value on this platform fits well inside
// Number.MAX_SAFE_INTEGER (2^53, ~9 PB), so parse them as numbers once, here.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10));
// date columns (usage.day) would otherwise become a Date at midnight in the
// *server's local* time zone, shifting a UTC day by the offset. Keep the
// calendar day as the 'YYYY-MM-DD' string it is.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export type DbOptions = {
  readonly url: string;
  readonly poolMax: number;
  readonly statementTimeoutMs: number;
  /** Shows up in pg_stat_activity, so an operator can tell api from worker. */
  readonly applicationName: string;
  /** Called when an idle pooled connection dies (see createDb). */
  readonly onPoolError?: (err: Error) => void;
};

export type Db = Kysely<Database>;
/** A transaction handle; repositories accept one and use it when given. */
export type Tx = Transaction<Database>;
/** Anything a query can run on. */
export type Executor = Db | Tx;

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
  // When PostgreSQL restarts, fails over, or an admin terminates backends,
  // idle pooled connections receive FATAL 57P01 and the pool emits "error".
  // An EventEmitter "error" with no listener crashes the Node process -- so
  // without this handler, one database restart would take down every api and
  // worker replica. The pool discards the broken client by itself; we only
  // need to observe it. (Found by the /readyz integration test stopping a
  // real PostgreSQL.)
  pool.on("error", (err) => options.onPoolError?.(err));
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
};
