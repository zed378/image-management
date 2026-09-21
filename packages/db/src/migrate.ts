// Kysely 0.29 moved the migrator to its own entry point.
import { Migrator, type MigrationResultSet } from "kysely/migration";

import { MIGRATIONS } from "./migrations";

import type { Kysely } from "kysely";

const migratorFor = <DB>(db: Kysely<DB>): Migrator =>
  new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve({ ...MIGRATIONS }) },
  });

export type MigrationOutcome = {
  readonly applied: readonly string[];
};

const unwrap = (result: MigrationResultSet): MigrationOutcome => {
  if (result.error) {
    const failed = result.results?.find((r) => r.status === "Error")?.migrationName;
    throw new Error(`migration ${failed ?? "(unknown)"} failed`, { cause: result.error });
  }
  return {
    applied: (result.results ?? [])
      .filter((r) => r.status === "Success")
      .map((r) => r.migrationName),
  };
};

/** Apply every pending migration, in order. Idempotent. */
export const migrateToLatest = async <DB>(db: Kysely<DB>): Promise<MigrationOutcome> =>
  unwrap(await migratorFor(db).migrateToLatest());

/** Revert the most recently applied migration. Development and tests only. */
export const migrateDownOne = async <DB>(db: Kysely<DB>): Promise<MigrationOutcome> =>
  unwrap(await migratorFor(db).migrateDown());

export const migrationNames = (): readonly string[] => Object.keys(MIGRATIONS).sort();
