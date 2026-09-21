// Integration-test global setup (P0-02, docs/ENGINEERING/09).
//
// Starts one throwaway PostgreSQL, Redis and MinIO for the whole integration
// run through Testcontainers, and hands their addresses to test files via
// Vitest's provide/inject. Nothing here touches the developer's compose stack.

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

import type { TestProject } from "vitest/node";

import "./provided-context";

export const TEST_IMAGES = {
  postgres: "postgres:17-alpine",
  redis: "redis:7.4-alpine",
  minio: "quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z",
} as const;

export const TEST_MINIO = {
  accessKeyId: "test_access_key",
  secretAccessKey: "test_secret_key_0123456789",
  bucket: "image-delivery-test",
  region: "us-east-1",
} as const;

export const startMinio = async (): Promise<StartedTestContainer> => {
  const container = await new GenericContainer(TEST_IMAGES.minio)
    .withCommand(["server", "/data"])
    .withEnvironment({
      MINIO_ROOT_USER: TEST_MINIO.accessKeyId,
      MINIO_ROOT_PASSWORD: TEST_MINIO.secretAccessKey,
    })
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forHttp("/minio/health/live", 9000))
    .start();

  // Create the bucket with the mc binary shipped inside the MinIO image, so
  // test setup needs no S3 SDK outside packages/storage-adapter (ADR-001).
  const alias = await container.exec([
    "mc",
    "alias",
    "set",
    "local",
    "http://127.0.0.1:9000",
    TEST_MINIO.accessKeyId,
    TEST_MINIO.secretAccessKey,
  ]);
  if (alias.exitCode !== 0) throw new Error(`mc alias failed: ${alias.output}`);
  const mb = await container.exec(["mc", "mb", "--ignore-existing", `local/${TEST_MINIO.bucket}`]);
  if (mb.exitCode !== 0) throw new Error(`mc mb failed: ${mb.output}`);

  return container;
};

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis, minio]: [
    StartedPostgreSqlContainer,
    StartedRedisContainer,
    StartedTestContainer,
  ] = await Promise.all([
    new PostgreSqlContainer(TEST_IMAGES.postgres)
      .withDatabase("image_delivery_test")
      .withUsername("image_delivery")
      .withPassword("image_delivery_test")
      .start(),
    new RedisContainer(TEST_IMAGES.redis).start(),
    startMinio(),
  ]);

  project.provide("postgresAdminUrl", postgres.getConnectionUri());
  project.provide("redisUrl", redis.getConnectionUrl());
  project.provide("s3Endpoint", `http://${minio.getHost()}:${minio.getMappedPort(9000)}`);

  return async () => {
    await Promise.all([postgres.stop(), redis.stop(), minio.stop()]);
  };
}
