import { z } from "zod";

// Reusable pieces of environment schema. Each service composes the fragments
// it needs (services/*/src/config.ts); nothing here reads process.env.

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const intInRange = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const NODE_ENVS = ["development", "test", "production"] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const processFragment = {
  NODE_ENV: z.enum(NODE_ENVS).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  /** Set by the build/deploy pipeline; appears on every log line. */
  SERVICE_VERSION: z.string().max(64).default("dev"),
};

export const databaseFragment = {
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// URL"),
  DATABASE_POOL_MAX: intInRange(1, 200).default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: intInRange(100, 600_000).default(5_000),
};

export const redisFragment = {
  REDIS_URL: z.string().regex(/^rediss?:\/\//, "must be a redis:// or rediss:// URL"),
};

export const STORAGE_PROVIDERS = ["s3", "local"] as const;

export const storageFragment = {
  STORAGE_PROVIDER: z.enum(STORAGE_PROVIDERS),
  /** Omit for AWS S3's default endpoint; set for R2, MinIO, or any S3-compatible store. */
  STORAGE_S3_ENDPOINT: z.url().optional(),
  STORAGE_S3_REGION: z.string().min(1).max(64).default("us-east-1"),
  STORAGE_S3_BUCKET: z.string().min(3).max(63).optional(),
  /** Optional: omitted in environments that grant access through an IAM role. */
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_S3_FORCE_PATH_STYLE: booleanString.default(false),
  STORAGE_LOCAL_ROOT: z.string().min(1).optional(),
};

type StorageEnv = {
  STORAGE_PROVIDER: (typeof STORAGE_PROVIDERS)[number];
  STORAGE_S3_BUCKET?: string | undefined;
  STORAGE_S3_ACCESS_KEY_ID?: string | undefined;
  STORAGE_S3_SECRET_ACCESS_KEY?: string | undefined;
  STORAGE_LOCAL_ROOT?: string | undefined;
};

/** Cross-field rules the flat fragment cannot express on its own. */
export const refineStorage = (env: StorageEnv, ctx: z.RefinementCtx): void => {
  if (env.STORAGE_PROVIDER === "s3" && !env.STORAGE_S3_BUCKET) {
    ctx.addIssue({
      code: "custom",
      path: ["STORAGE_S3_BUCKET"],
      message: "is required when STORAGE_PROVIDER=s3",
    });
  }
  if (env.STORAGE_PROVIDER === "local" && !env.STORAGE_LOCAL_ROOT) {
    ctx.addIssue({
      code: "custom",
      path: ["STORAGE_LOCAL_ROOT"],
      message: "is required when STORAGE_PROVIDER=local",
    });
  }
  // A half-configured static credential is always a mistake: either both
  // halves (static keys) or neither (IAM role).
  if (Boolean(env.STORAGE_S3_ACCESS_KEY_ID) !== Boolean(env.STORAGE_S3_SECRET_ACCESS_KEY)) {
    ctx.addIssue({
      code: "custom",
      path: [env.STORAGE_S3_ACCESS_KEY_ID ? "STORAGE_S3_SECRET_ACCESS_KEY" : "STORAGE_S3_ACCESS_KEY_ID"],
      message: "must be set together with its pair, or both omitted to use an IAM role",
    });
  }
};

// --- Typed, nested shapes the rest of the code receives ---------------------

export type ProcessConfig = {
  readonly nodeEnv: NodeEnv;
  readonly logLevel: LogLevel;
  readonly serviceVersion: string;
};

export type DatabaseConfig = {
  readonly url: string;
  readonly poolMax: number;
  readonly statementTimeoutMs: number;
};

export type RedisConfig = {
  readonly url: string;
};

export type StorageConfig =
  | {
      readonly provider: "s3";
      readonly bucket: string;
      readonly region: string;
      readonly endpoint: string | undefined;
      readonly forcePathStyle: boolean;
      readonly credentials: { readonly accessKeyId: string; readonly secretAccessKey: string } | undefined;
    }
  | {
      readonly provider: "local";
      readonly root: string;
    };

export const toProcessConfig = (env: {
  NODE_ENV: NodeEnv;
  LOG_LEVEL: LogLevel;
  SERVICE_VERSION: string;
}): ProcessConfig => ({
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  serviceVersion: env.SERVICE_VERSION,
});

export const toDatabaseConfig = (env: {
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
  DATABASE_STATEMENT_TIMEOUT_MS: number;
}): DatabaseConfig => ({
  url: env.DATABASE_URL,
  poolMax: env.DATABASE_POOL_MAX,
  statementTimeoutMs: env.DATABASE_STATEMENT_TIMEOUT_MS,
});

export const toRedisConfig = (env: { REDIS_URL: string }): RedisConfig => ({ url: env.REDIS_URL });

export const toStorageConfig = (env: {
  STORAGE_PROVIDER: (typeof STORAGE_PROVIDERS)[number];
  STORAGE_S3_ENDPOINT?: string | undefined;
  STORAGE_S3_REGION: string;
  STORAGE_S3_BUCKET?: string | undefined;
  STORAGE_S3_ACCESS_KEY_ID?: string | undefined;
  STORAGE_S3_SECRET_ACCESS_KEY?: string | undefined;
  STORAGE_S3_FORCE_PATH_STYLE: boolean;
  STORAGE_LOCAL_ROOT?: string | undefined;
}): StorageConfig => {
  if (env.STORAGE_PROVIDER === "local") {
    // refineStorage guarantees presence; the fallback is unreachable.
    return { provider: "local", root: env.STORAGE_LOCAL_ROOT ?? "" };
  }
  return {
    provider: "s3",
    bucket: env.STORAGE_S3_BUCKET ?? "",
    region: env.STORAGE_S3_REGION,
    endpoint: env.STORAGE_S3_ENDPOINT,
    forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
    credentials:
      env.STORAGE_S3_ACCESS_KEY_ID && env.STORAGE_S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY }
        : undefined,
  };
};
