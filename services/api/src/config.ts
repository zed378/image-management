import { z } from "zod";

import {
  credentialsFragment,
  databaseFragment,
  parseConfig,
  refineCredentials,
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

const apiEnvSchema = z
  .object({
    ...processFragment,
    ...databaseFragment,
    ...redisFragment,
    ...storageFragment,
    ...credentialsFragment,
    HTTP_HOST: z.string().min(1).default("0.0.0.0"),
    HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  })
  .superRefine((env, ctx) => {
    refineStorage(env, ctx);
    refineCredentials(env, ctx);
  });

export type ApiConfig = {
  readonly process: ProcessConfig;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly storage: StorageConfig;
  readonly http: { readonly host: string; readonly port: number };
  readonly credentials: { readonly apiKeyPepper: string };
};

export const loadApiConfig = (env: RawEnv): ApiConfig => {
  const e = parseConfig(apiEnvSchema, env);
  return {
    process: toProcessConfig(e),
    database: toDatabaseConfig(e),
    redis: toRedisConfig(e),
    storage: toStorageConfig(e),
    http: { host: e.HTTP_HOST, port: e.HTTP_PORT },
    credentials: { apiKeyPepper: e.API_KEY_PEPPER },
  };
};
