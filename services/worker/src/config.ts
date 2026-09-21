import {
  databaseFragment,
  parseConfig,
  processFragment,
  redisFragment,
  refineStorage,
  storageFragment,
  toDatabaseConfig,
  toProcessConfig,
  toRedisConfig,
  toStorageConfig,
  type DatabaseConfig,
  type ProcessConfig,
  type RawEnv,
  type RedisConfig,
  type StorageConfig,
} from "@image-delivery/config";
import { z } from "zod";

const workerEnvSchema = z
  .object({
    ...processFragment,
    ...databaseFragment,
    ...redisFragment,
    ...storageFragment,
    /** Concurrent image-processing jobs per worker process (docs/PERFORMANCE/07). */
    WORKER_IMAGE_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(2),
    WORKER_WEBHOOK_CONCURRENCY: z.coerce.number().int().min(1).max(256).default(8),
  })
  .superRefine(refineStorage);

export type WorkerConfig = {
  readonly process: ProcessConfig;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly storage: StorageConfig;
  readonly concurrency: { readonly image: number; readonly webhook: number };
};

export const loadWorkerConfig = (env: RawEnv): WorkerConfig => {
  const e = parseConfig(workerEnvSchema, env);
  return {
    process: toProcessConfig(e),
    database: toDatabaseConfig(e),
    redis: toRedisConfig(e),
    storage: toStorageConfig(e),
    concurrency: { image: e.WORKER_IMAGE_CONCURRENCY, webhook: e.WORKER_WEBHOOK_CONCURRENCY },
  };
};
