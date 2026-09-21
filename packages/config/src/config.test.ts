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

  it.each(["DATABASE_URL", "REDIS_URL"] as const)(
    "fails naming %s when it is missing",
    (variable) => {
      const env: Record<string, string> = { ...validEnv };
      Reflect.deleteProperty(env, variable);

      const error = configErrorOf(() => parseConfig(schema, env));

      expect(error.issues).toContainEqual({ variable, reason: "is required but not set" });
      expect(error.message).toContain(variable);
    },
  );

  it("reports every problem at once, not only the first", () => {
    const error = configErrorOf(() => parseConfig(schema, {}));

    const names = error.issues.map((i) => i.variable);
    expect(names).toEqual(expect.arrayContaining(["DATABASE_URL", "REDIS_URL"]));
  });

  it("treats an empty string as unset", () => {
    const error = configErrorOf(() => parseConfig(schema, { ...validEnv, DATABASE_URL: "" }));

    expect(error.issues).toContainEqual({
      variable: "DATABASE_URL",
      reason: "is required but not set",
    });
  });

  it("never includes a secret value in the error message", () => {
    const leaky = {
      ...validEnv,
      DATABASE_URL: "mysql://root:s3cr3t-db-password@db/x",
      LOG_LEVEL: "loud",
    };

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
    const error = configErrorOf(() =>
      parseConfig(schema, { ...validEnv, DATABASE_POOL_MAX: "ten" }),
    );

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

  it("defaults to local storage under .data/storage outside production", () => {
    const env = { DATABASE_URL: validEnv.DATABASE_URL, REDIS_URL: validEnv.REDIS_URL };

    expect(toStorageConfig(parseConfig(schema, env))).toEqual({
      provider: "local",
      root: ".data/storage",
    });
  });

  it("requires an explicit local root in production, so an ephemeral disk is never used silently", () => {
    const env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      NODE_ENV: "production",
    };

    const error = configErrorOf(() => parseConfig(schema, env));

    expect(error.issues).toContainEqual({
      variable: "STORAGE_LOCAL_ROOT",
      reason: "is required when STORAGE_PROVIDER=local and NODE_ENV=production",
    });
  });

  it("accepts a local root on a mounted network filesystem", () => {
    const env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      STORAGE_LOCAL_ROOT: "/mnt/nfs/images",
    };

    expect(toStorageConfig(parseConfig(schema, env))).toEqual({
      provider: "local",
      root: "/mnt/nfs/images",
    });
  });

  it.each([
    [
      "azure-blob",
      ["STORAGE_AZURE_ACCOUNT_NAME", "STORAGE_AZURE_ACCOUNT_KEY", "STORAGE_AZURE_CONTAINER"],
    ],
    ["sftp", ["STORAGE_SFTP_HOST", "STORAGE_SFTP_USERNAME", "STORAGE_SFTP_PASSWORD"]],
    ["webdav", ["STORAGE_WEBDAV_URL"]],
  ] as const)("requires the %s connection variables", (provider, variables) => {
    const env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      STORAGE_PROVIDER: provider,
    };

    const error = configErrorOf(() => parseConfig(schema, env));

    expect(error.issues.map((i) => i.variable)).toEqual(expect.arrayContaining([...variables]));
  });

  it("requires an SFTP host key fingerprint in production", () => {
    const env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      NODE_ENV: "production",
      STORAGE_PROVIDER: "sftp",
      STORAGE_SFTP_HOST: "files.example.com",
      STORAGE_SFTP_USERNAME: "images",
      STORAGE_SFTP_PASSWORD: "pw",
    };

    const error = configErrorOf(() => parseConfig(schema, env));

    expect(error.issues.map((i) => i.variable)).toContain("STORAGE_SFTP_HOST_KEY_SHA256");
  });

  it("turns escaped newlines in an SFTP private key into real ones", () => {
    const env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      STORAGE_PROVIDER: "sftp",
      STORAGE_SFTP_HOST: "files.example.com",
      STORAGE_SFTP_USERNAME: "images",
      // As written in a single-line .env file: literal backslash-n sequences.
      STORAGE_SFTP_PRIVATE_KEY: String.raw`-----BEGIN KEY-----\nabc\n-----END KEY-----`,
    };

    const storage = toStorageConfig(parseConfig(schema, env));

    expect(storage).toMatchObject({
      provider: "sftp",
      privateKey: "-----BEGIN KEY-----\nabc\n-----END KEY-----",
    });
  });

  it.each([
    [
      "s3",
      { STORAGE_S3_BUCKET: "images" },
      {
        provider: "s3",
        bucket: "images",
        region: "us-east-1",
        endpoint: undefined,
        forcePathStyle: false,
        credentials: undefined,
      },
    ],
    [
      "azure-blob",
      {
        STORAGE_AZURE_ACCOUNT_NAME: "acct",
        STORAGE_AZURE_ACCOUNT_KEY: "key",
        STORAGE_AZURE_CONTAINER: "images",
      },
      {
        provider: "azure-blob",
        accountName: "acct",
        accountKey: "key",
        container: "images",
        endpoint: undefined,
      },
    ],
    [
      "sftp",
      {
        STORAGE_SFTP_HOST: "files.example.com",
        STORAGE_SFTP_USERNAME: "images",
        STORAGE_SFTP_PASSWORD: "pw",
      },
      {
        provider: "sftp",
        host: "files.example.com",
        port: 22,
        username: "images",
        password: "pw",
        privateKey: undefined,
        root: "/",
        hostKeySha256: undefined,
      },
    ],
    [
      "webdav",
      { STORAGE_WEBDAV_URL: "https://dav.example.com/images" },
      {
        provider: "webdav",
        url: "https://dav.example.com/images",
        username: undefined,
        password: undefined,
        root: "/",
      },
    ],
  ] as const)(
    "maps a minimal %s configuration with its documented defaults",
    (provider, vars, expected) => {
      const env = {
        DATABASE_URL: validEnv.DATABASE_URL,
        REDIS_URL: validEnv.REDIS_URL,
        STORAGE_PROVIDER: provider,
        ...vars,
      };

      expect(toStorageConfig(parseConfig(schema, env))).toEqual(expected);
    },
  );

  it("accepts an SFTP private key instead of a password", () => {
    const env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      STORAGE_PROVIDER: "sftp",
      STORAGE_SFTP_HOST: "files.example.com",
      STORAGE_SFTP_USERNAME: "images",
      STORAGE_SFTP_PRIVATE_KEY: "key",
    };

    expect(toStorageConfig(parseConfig(schema, env))).toMatchObject({ password: undefined });
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
