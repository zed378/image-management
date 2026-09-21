import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createLogger } from "@image-delivery/logger";
import { MemoryStorageAdapter } from "@image-delivery/storage-adapter";
import { createTestDatabase, type TestDatabase } from "@image-delivery/test-utils";

import { ISOLATION_CASES } from "./isolation/cases";
import {
  createTenantFixture,
  runIsolationCase,
  type IsolationDeps,
  type TenantFixture,
} from "./isolation/harness";
import { buildApp } from "../src/app";
import { createApiKeyService } from "../src/modules/api-keys/api-key.service";
import { createAssetModule } from "../src/modules/assets/asset.module";

import type { FastifyInstance } from "fastify";

// P1-05: the tenant-isolation suite (docs/SECURITY/11). Two fully seeded
// tenants; for every case in isolation/cases.ts, tenant B's key -- holding
// every permission -- must get 404 for tenant A's resource, and tenant A's
// own key must not. SEC-TEN-03.

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

let t: TestDatabase;
let deps: IsolationDeps;
let app: FastifyInstance;
let a: TenantFixture;
let b: TenantFixture;

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
  deps = {
    db: t.db,
    apiKeys: createApiKeyService({ db: t.db, pepper: PEPPER }),
    storage: new MemoryStorageAdapter(),
  };
  app = await buildApp({
    logger: createLogger({ service: "api", version: "test", level: "silent" }),
    readinessChecks: {},
    apiKeys: deps.apiKeys,
    assets: createAssetModule({ db: t.db, storage: deps.storage }),
  });
  a = await createTenantFixture(deps);
  b = await createTenantFixture(deps);
});
afterAll(async () => {
  await app.close();
  await t.destroy();
});

describe("tenant isolation (SEC-TEN-03)", () => {
  it.each(ISOLATION_CASES.map((c) => [c.route, c] as const))(
    "%s: another tenant gets 404, the owner does not",
    async (_route, testCase) => {
      const outcome = await runIsolationCase(app, deps, a, b, testCase);

      expect(outcome.attacker).toBe(404);
      expect(outcome.owner).not.toBe(404);
      expect(outcome.owner).toBeLessThan(400);
    },
  );
});
