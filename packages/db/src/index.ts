// PostgreSQL connection, migrations, and (P1-05) the scoped() base
// repository. docs/DATABASE/, docs/ENGINEERING/07, ADR-005, ADR-020.

export { createDb, type Db, type DbOptions } from "./connection";
export { migrateDownOne, migrateToLatest, migrationNames, type MigrationOutcome } from "./migrate";
export type * from "./types";
