// PostgreSQL connection, migrations, and (P1-05) the scoped() base
// repository. docs/DATABASE/, docs/ENGINEERING/07, ADR-005, ADR-020.

export { createDb, type Db, type DbOptions, type Executor, type Tx } from "./connection";
export { migrateDownOne, migrateToLatest, migrationNames, type MigrationOutcome } from "./migrate";
export {
  scoped,
  ScopeError,
  TENANT_OWNED_TABLES,
  unsafeUnscoped,
  type ProjectOwnedTable,
  type ScopeContext,
  type TenantOwnedTable,
  type UnscopedReason,
} from "./scoped";
export type * from "./types";
