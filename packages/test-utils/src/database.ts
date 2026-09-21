import { randomBytes } from "node:crypto";

import { createDb, migrateToLatest, type Db } from "@image-delivery/db";
import pg from "pg";

// One fresh, fully-migrated database per test file. Isolation by database
// (not by transaction rollback) so tests can exercise real commits, triggers,
// constraint violations, and concurrent connections.

export type TestDatabase = {
  readonly db: Db;
  readonly url: string;
  readonly name: string;
  /** Close the pool and drop the database. Call in afterAll. */
  readonly destroy: () => Promise<void>;
};

const withAdmin = async <T>(adminUrl: string, fn: (client: pg.Client) => Promise<T>): Promise<T> => {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

/** Create an empty database. `migrate: false` for migration tests themselves. */
export const createTestDatabase = async (
  adminUrl: string,
  options: { migrate?: boolean } = {},
): Promise<TestDatabase> => {
  const name = `test_${randomBytes(6).toString("hex")}`;
  await withAdmin(adminUrl, (client) => client.query(`create database "${name}"`));

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = createDb({
    url: url.toString(),
    poolMax: 5,
    statementTimeoutMs: 30_000,
    applicationName: "integration-test",
  });
  if (options.migrate !== false) await migrateToLatest(db);

  return {
    db,
    url: url.toString(),
    name,
    destroy: async () => {
      await db.destroy();
      await withAdmin(adminUrl, (client) => client.query(`drop database if exists "${name}" with (force)`));
    },
  };
};
