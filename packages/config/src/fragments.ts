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

/** ADR-021: local disk is the default; network filesystems (NFS, SMB, EFS) mount as `local`. */
export const STORAGE_PROVIDERS = ["local", "s3", "azure-blob", "sftp", "webdav"] as const;
export type StorageProviderName = (typeof STORAGE_PROVIDERS)[number];

/** Development default for STORAGE_LOCAL_ROOT; production must set it explicitly. */
export const DEFAULT_DEV_STORAGE_ROOT = ".data/storage";

export const storageFragment = {
  STORAGE_PROVIDER: z.enum(STORAGE_PROVIDERS).default("local"),
  /** local: a directory on a local disk or a mounted network filesystem. */
  STORAGE_LOCAL_ROOT: z.string().min(1).optional(),
  /** Omit for AWS S3's default endpoint; set for R2, MinIO, or any S3-compatible store. */
  STORAGE_S3_ENDPOINT: z.url().optional(),
  STORAGE_S3_REGION: z.string().min(1).max(64).default("us-east-1"),
  STORAGE_S3_BUCKET: z.string().min(3).max(63).optional(),
  /** Optional: omitted in environments that grant access through an IAM role. */
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_S3_FORCE_PATH_STYLE: booleanString.default(false),
  // azure-blob
  STORAGE_AZURE_ACCOUNT_NAME: z.string().min(3).max(24).optional(),
  STORAGE_AZURE_ACCOUNT_KEY: z.string().min(1).optional(),
  STORAGE_AZURE_CONTAINER: z.string().min(3).max(63).optional(),
  /** Omit for the public cloud; set for Azurite or a sovereign cloud. */
  STORAGE_AZURE_ENDPOINT: z.url().optional(),
  // sftp
  STORAGE_SFTP_HOST: z.string().min(1).optional(),
  STORAGE_SFTP_PORT: intInRange(1, 65_535).default(22),
  STORAGE_SFTP_USERNAME: z.string().min(1).optional(),
  STORAGE_SFTP_PASSWORD: z.string().min(1).optional(),
  /** PEM private key; a literal backslash-n sequence is accepted as a newline. */
  STORAGE_SFTP_PRIVATE_KEY: z.string().min(1).optional(),
  STORAGE_SFTP_ROOT: z.string().min(1).default("/"),
  /** Base64 SHA-256 host key fingerprint; required in production (MITM defence). */
  STORAGE_SFTP_HOST_KEY_SHA256: z.string().min(1).optional(),
  // webdav
  STORAGE_WEBDAV_URL: z.url().optional(),
  STORAGE_WEBDAV_USERNAME: z.string().min(1).optional(),
  STORAGE_WEBDAV_PASSWORD: z.string().min(1).optional(),
  STORAGE_WEBDAV_ROOT: z.string().min(1).default("/"),
};

type StorageEnv = {
  NODE_ENV?: string | undefined;
  STORAGE_PROVIDER: StorageProviderName;
  STORAGE_LOCAL_ROOT?: string | undefined;
  STORAGE_S3_REGION?: string | undefined;
  STORAGE_S3_ENDPOINT?: string | undefined;
  STORAGE_S3_BUCKET?: string | undefined;
  STORAGE_S3_ACCESS_KEY_ID?: string | undefined;
  STORAGE_S3_SECRET_ACCESS_KEY?: string | undefined;
  STORAGE_S3_FORCE_PATH_STYLE?: boolean | undefined;
  STORAGE_AZURE_ACCOUNT_NAME?: string | undefined;
  STORAGE_AZURE_ACCOUNT_KEY?: string | undefined;
  STORAGE_AZURE_CONTAINER?: string | undefined;
  STORAGE_AZURE_ENDPOINT?: string | undefined;
  STORAGE_SFTP_HOST?: string | undefined;
  STORAGE_SFTP_PORT?: number | undefined;
  STORAGE_SFTP_USERNAME?: string | undefined;
  STORAGE_SFTP_PASSWORD?: string | undefined;
  STORAGE_SFTP_PRIVATE_KEY?: string | undefined;
  STORAGE_SFTP_ROOT?: string | undefined;
  STORAGE_SFTP_HOST_KEY_SHA256?: string | undefined;
  STORAGE_WEBDAV_URL?: string | undefined;
  STORAGE_WEBDAV_USERNAME?: string | undefined;
  STORAGE_WEBDAV_PASSWORD?: string | undefined;
  STORAGE_WEBDAV_ROOT?: string | undefined;
};

/** Cross-field rules the flat fragment cannot express on its own. */
export const refineStorage = (env: StorageEnv, ctx: z.RefinementCtx): void => {
  const requireVar = (variable: keyof StorageEnv, when: string): void => {
    if (!env[variable]) ctx.addIssue({ code: "custom", path: [variable], message: `is required when ${when}` });
  };
  const production = env.NODE_ENV === "production";

  switch (env.STORAGE_PROVIDER) {
    case "local":
      // A container writing to its own ephemeral filesystem loses every
      // original on restart. Production must name the (persistent, and for
      // more than one host, shared) directory explicitly.
      if (production) requireVar("STORAGE_LOCAL_ROOT", "STORAGE_PROVIDER=local and NODE_ENV=production");
      break;
    case "s3":
      requireVar("STORAGE_S3_BUCKET", "STORAGE_PROVIDER=s3");
      break;
    case "azure-blob":
      requireVar("STORAGE_AZURE_ACCOUNT_NAME", "STORAGE_PROVIDER=azure-blob");
      requireVar("STORAGE_AZURE_ACCOUNT_KEY", "STORAGE_PROVIDER=azure-blob");
      requireVar("STORAGE_AZURE_CONTAINER", "STORAGE_PROVIDER=azure-blob");
      break;
    case "sftp":
      requireVar("STORAGE_SFTP_HOST", "STORAGE_PROVIDER=sftp");
      requireVar("STORAGE_SFTP_USERNAME", "STORAGE_PROVIDER=sftp");
      if (!env.STORAGE_SFTP_PASSWORD && !env.STORAGE_SFTP_PRIVATE_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["STORAGE_SFTP_PASSWORD"],
          message: "or STORAGE_SFTP_PRIVATE_KEY is required when STORAGE_PROVIDER=sftp",
        });
      }
      if (production) requireVar("STORAGE_SFTP_HOST_KEY_SHA256", "STORAGE_PROVIDER=sftp and NODE_ENV=production");
      break;
    case "webdav":
      requireVar("STORAGE_WEBDAV_URL", "STORAGE_PROVIDER=webdav");
      break;
  }

  // A half-configured static S3 credential is always a mistake: both halves
  // (static keys) or neither (IAM role).
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
  | { readonly provider: "local"; readonly root: string }
  | {
      readonly provider: "s3";
      readonly bucket: string;
      readonly region: string;
      readonly endpoint: string | undefined;
      readonly forcePathStyle: boolean;
      readonly credentials: { readonly accessKeyId: string; readonly secretAccessKey: string } | undefined;
    }
  | {
      readonly provider: "azure-blob";
      readonly accountName: string;
      readonly accountKey: string;
      readonly container: string;
      readonly endpoint: string | undefined;
    }
  | {
      readonly provider: "sftp";
      readonly host: string;
      readonly port: number;
      readonly username: string;
      readonly password: string | undefined;
      readonly privateKey: string | undefined;
      readonly root: string;
      readonly hostKeySha256: string | undefined;
    }
  | {
      readonly provider: "webdav";
      readonly url: string;
      readonly username: string | undefined;
      readonly password: string | undefined;
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

// refineStorage has already guaranteed every required value for the chosen
// provider; the `?? ""` fallbacks below are unreachable by construction.
export const toStorageConfig = (env: StorageEnv): StorageConfig => {
  switch (env.STORAGE_PROVIDER) {
    case "local":
      return { provider: "local", root: env.STORAGE_LOCAL_ROOT ?? DEFAULT_DEV_STORAGE_ROOT };
    case "s3":
      return {
        provider: "s3",
        bucket: env.STORAGE_S3_BUCKET ?? "",
        region: env.STORAGE_S3_REGION ?? "us-east-1",
        endpoint: env.STORAGE_S3_ENDPOINT,
        forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE ?? false,
        credentials:
          env.STORAGE_S3_ACCESS_KEY_ID && env.STORAGE_S3_SECRET_ACCESS_KEY
            ? { accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY }
            : undefined,
      };
    case "azure-blob":
      return {
        provider: "azure-blob",
        accountName: env.STORAGE_AZURE_ACCOUNT_NAME ?? "",
        accountKey: env.STORAGE_AZURE_ACCOUNT_KEY ?? "",
        container: env.STORAGE_AZURE_CONTAINER ?? "",
        endpoint: env.STORAGE_AZURE_ENDPOINT,
      };
    case "sftp":
      return {
        provider: "sftp",
        host: env.STORAGE_SFTP_HOST ?? "",
        port: env.STORAGE_SFTP_PORT ?? 22,
        username: env.STORAGE_SFTP_USERNAME ?? "",
        password: env.STORAGE_SFTP_PASSWORD,
        privateKey: env.STORAGE_SFTP_PRIVATE_KEY?.split(String.raw`\n`).join("\n"),
        root: env.STORAGE_SFTP_ROOT ?? "/",
        hostKeySha256: env.STORAGE_SFTP_HOST_KEY_SHA256,
      };
    case "webdav":
      return {
        provider: "webdav",
        url: env.STORAGE_WEBDAV_URL ?? "",
        username: env.STORAGE_WEBDAV_USERNAME,
        password: env.STORAGE_WEBDAV_PASSWORD,
        root: env.STORAGE_WEBDAV_ROOT ?? "/",
      };
  }
};
