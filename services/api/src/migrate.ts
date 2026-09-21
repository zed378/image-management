// `node dist/migrate.js` (production image) or `pnpm db:migrate` (local).
// Runs as an explicit deploy step before the new version serves traffic
// (docs/DEVOPS/05-DATABASE-MIGRATION.md). Needs only DATABASE_URL, so it can
// run from a job that has no access to Redis or storage.

import { z } from "zod";

import {
  ConfigError,
  databaseFragment,
  parseConfig,
  toDatabaseConfig,
  withDotEnv,
} from "@image-delivery/config";
import { createDb, migrateToLatest } from "@image-delivery/db";

const main = async (): Promise<void> => {
  let database;
  try {
    database = toDatabaseConfig(parseConfig(z.object(databaseFragment), withDotEnv(process.env)));
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`migrate: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  // Migrations may legitimately run longer than a request-path statement.
  const db = createDb({ ...database, statementTimeoutMs: 600_000, applicationName: "migrate" });
  try {
    const { applied } = await migrateToLatest(db);
    process.stdout.write(
      applied.length === 0
        ? "migrate: already up to date\n"
        : `migrate: applied ${applied.join(", ")}\n`,
    );
  } finally {
    await db.destroy();
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`migrate: failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
