import { sql } from "kysely";

import type { ReadinessCheck } from "./modules/health/health.routes";
import type { RedisClient } from "@image-delivery/cache";
import type { Db } from "@image-delivery/db";
import type { StorageAdapter } from "@image-delivery/storage-adapter";

/** A valid key that is never written; stat() on it proves the backend answers. */
export const STORAGE_PROBE_KEY = "health/readiness-probe";

/**
 * The api's readiness checks. Each must fail -- not hang -- when its
 * dependency is gone; the route adds a timeout as a second guarantee.
 */
export const readinessChecks = (deps: {
  readonly db: Db;
  readonly redis: RedisClient;
  readonly storage: StorageAdapter;
}): Record<string, ReadinessCheck> => ({
  database: async () => {
    await sql`select 1`.execute(deps.db);
  },
  redis: async () => {
    await deps.redis.ping();
  },
  storage: async () => {
    await deps.storage.stat(STORAGE_PROBE_KEY);
  },
});
