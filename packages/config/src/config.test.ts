import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ConfigError } from "./config-error";
import {
  databaseFragment,
  processFragment,
  redisFragment,
  refineStorage,
  storageFragment,
  toStorageConfig,
} from "./fragments";
import { parseConfig, withDotEnv } from "./load-config";

const schema = z
  .object({ ...processFragment, ...databaseFragment, ...redisFragment, ...storageFragment })
  .superRefine(refineStorage);

const validEnv = {
  DATABASE_URL: "postgres://user:s3cr3t-db-password@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_PROVIDER: "s3",
  STORAGE_S3_BUCKET: "images",
  STORAGE_S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
  STORAGE_S3_SECRET_ACCESS_KEY: "s3cr3t-storage-key",
} as const;

const configErrorOf = (fn: () => unknown): ConfigError => {
  try {
    fn();
  } catch (err) {
    if (err instanceof ConfigError) return err;
    throw err;
  }
  throw new Error("expected a ConfigError");
};

describe("parseConfig", () => {
  it("returns typed values with defaults applied", () => {
    const config = parseConfig(schema, validEnv);

    expect(config.NODE_ENV).toBe("development");
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.DATABASE_POOL_MAX).toBe(10);
    expect(config.STORAGE_S3_FORCE_PATH_STYLE).toBe(false);
  });

  it.each(["DATABASE_URL", "REDIS_URL", "STORAGE_PROVIDER"] as const)(
    "fails naming %s when it is missing",
    (variable) => {
      const env: Record<string, string> = { ...validEnv };
      delete env[variable];

      const error = configErrorOf(() => parseConfig(schema, env));

      expect(error.issues).toContainEqual({ variable, reason: "is required but not set" });
      expect(error.message).toContain(variable);
    },
  );

  it("reports every problem at once, not only the first", () => {
    const error = configErrorOf(() => parseConfig(schema, {}));

    const names = error.issues.map((i) => i.variable);
    expect(names).toEqual(expect.arrayContaining(["DATABASE_URL", "REDIS_URL", "STORAGE_PROVIDER"]));
  });

  it("treats an empty string as unset", () => {
    const error = configErrorOf(() => parseConfig(schema, { ...validEnv, DATABASE_URL: "" }));

    expect(error.issues).toContainEqual({ variable: "DATABASE_URL", reason: "is required but not set" });
  });

  it("never includes a secret value in the error message", () => {
    const leaky = { ...validEnv, DATABASE_URL: "mysql://root:s3cr3t-db-password@db/x", LOG_LEVEL: "loud" };

    const error = configErrorOf(() => parseConfig(schema, leaky));

    expect(error.message).not.toContain("s3cr3t");
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).toContain("LOG_LEVEL");
  });

  it("lists the allowed values for an enum variable", () => {
    const error = configErrorOf(() => parseConfig(schema, { ...validEnv, NODE_ENV: "staging" }));

    expect(error.issues).toContainEqual({
      variable: "NODE_ENV",
      reason: "must be one of: development, test, production",
    });
  });

  it("rejects a non-integer pool size", () => {
    const error = configErrorOf(() => parseConfig(schema, { ...validEnv, DATABASE_POOL_MAX: "ten" }));

    expect(error.issues.map((i) => i.variable)).toContain("DATABASE_POOL_MAX");
  });
});

describe("refineStorage", () => {
  it("requires a bucket when the provider is s3", () => {
    const env: Record<string, string> = { ...validEnv };
    delete env["STORAGE_S3_BUCKET"];

    const error = configErrorOf(() => parseConfig(schema, env));

    expect(error.issues).toContainEqual({
      variable: "STORAGE_S3_BUCKET",
      reason: "is required when STORAGE_PROVIDER=s3",
    });
  });

  it("requires a root directory when the provider is local", () => {
    const error = configErrorOf(() =>
      parseConfig(schema, { ...validEnv, STORAGE_PROVIDER: "local" }),
    );

    expect(error.issues.map((i) => i.variable)).toContain("STORAGE_LOCAL_ROOT");
  });

  it("rejects a half-configured static credential", () => {
    const env: Record<string, string> = { ...validEnv };
    delete env["STORAGE_S3_SECRET_ACCESS_KEY"];

    const error = configErrorOf(() => parseConfig(schema, env));

    expect(error.issues.map((i) => i.variable)).toContain("STORAGE_S3_SECRET_ACCESS_KEY");
  });

  it("accepts no static credentials at all, for IAM-role environments", () => {
    const env: Record<string, string> = { ...validEnv };
    delete env["STORAGE_S3_ACCESS_KEY_ID"];
    delete env["STORAGE_S3_SECRET_ACCESS_KEY"];

    const storage = toStorageConfig(parseConfig(schema, env));

    expect(storage).toMatchObject({ provider: "s3", credentials: undefined });
  });
});

describe("withDotEnv", () => {
  const dotEnvFile = (content: string): string => {
    const dir = mkdtempSync(path.join(tmpdir(), "config-test-"));
    const file = path.join(dir, ".env");
    writeFileSync(file, content);
    return file;
  };

  it("lets the process environment win over .env", () => {
    const file = dotEnvFile("LOG_LEVEL=debug\nREDIS_URL=redis://from-file:6379\n");

    const env = withDotEnv({ LOG_LEVEL: "warn" }, file);

    expect(env["LOG_LEVEL"]).toBe("warn");
    expect(env["REDIS_URL"]).toBe("redis://from-file:6379");
  });

  it("ignores .env entirely in production", () => {
    const file = dotEnvFile("REDIS_URL=redis://from-file:6379\n");

    const env = withDotEnv({ NODE_ENV: "production" }, file);

    expect(env["REDIS_URL"]).toBeUndefined();
  });

  it("returns the environment unchanged when there is no .env file", () => {
    const env = withDotEnv({ LOG_LEVEL: "warn" }, path.join(tmpdir(), "does-not-exist", ".env"));

    expect(env).toEqual({ LOG_LEVEL: "warn" });
  });
});
