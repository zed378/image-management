import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRedisClient, type RedisClient } from "@image-delivery/cache";
import { createDb, type Db } from "@image-delivery/db";
import { createLogger } from "@image-delivery/logger";
import { LocalFileSystemAdapter } from "@image-delivery/storage-adapter";

import { buildApp } from "../src/app";
import { readinessChecks } from "../src/readiness";

import type { FastifyInstance } from "fastify";

// P0-08 Definition of Done: /readyz genuinely fails when PostgreSQL or Redis
// is down -- verified by stopping the real dependency, not by a mock. This
// file owns its containers so stopping them cannot disturb other suites.

describe("/readyz against real dependencies", () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let db: Db;
  let redis: RedisClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer("postgres:17-alpine").start(),
      new RedisContainer("redis:7.4-alpine").start(),
    ]);
    db = createDb({
      url: postgres.getConnectionUri(),
      poolMax: 2,
      statementTimeoutMs: 2_000,
      applicationName: "readiness-test",
    });
    redis = createRedisClient(redisContainer.getConnectionUrl(), "readiness-test");
    await redis.connect();
    const storage = new LocalFileSystemAdapter({
      root: mkdtempSync(path.join(tmpdir(), "readyz-")),
    });
    app = await buildApp({
      logger: createLogger({ service: "api", version: "test", level: "silent" }),
      readinessChecks: readinessChecks({ db, redis, storage }),
    });
  });

  afterAll(async () => {
    // Guarded: beforeAll may have failed before assigning any of these.
    const started = { app, db, redis, postgres, redisContainer } as Partial<{
      app: FastifyInstance;
      db: Db;
      redis: RedisClient;
      postgres: StartedPostgreSqlContainer;
      redisContainer: StartedRedisContainer;
    }>;
    await started.app?.close();
    await started.db?.destroy().catch(() => undefined);
    started.redis?.disconnect();
    await Promise.allSettled([started.postgres?.stop(), started.redisContainer?.stop()]);
  });

  const readyz = async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    return { status: res.statusCode, body: res.json<Record<string, unknown>>() };
  };

  it("is ready while every dependency is up", async () => {
    const { status, body } = await readyz();

    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: { checks: { database: "ok", redis: "ok", storage: "ok" } },
    });
  });

  it("reports the database as failing once PostgreSQL is stopped", async () => {
    await postgres.stop();

    const { status, body } = await readyz();

    expect(status).toBe(503);
    expect(body).toMatchObject({ error: { code: "service_unavailable" } });
    const failing = (body["error"] as { details: { field: string }[] }).details.map((d) => d.field);
    expect(failing).toEqual(["database"]);
  });

  it("reports Redis as failing once Redis is stopped", async () => {
    await redisContainer.stop();

    const { status, body } = await readyz();

    expect(status).toBe(503);
    const failing = (body["error"] as { details: { field: string }[] }).details.map((d) => d.field);
    expect(failing).toEqual(expect.arrayContaining(["database", "redis"]));
    expect(failing).not.toContain("storage");
  });
});
