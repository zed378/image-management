import { randomBytes } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDb } from "@image-delivery/db";
import { newId } from "@image-delivery/schema";
import { systemContext, type TenantContext } from "@image-delivery/tenancy";
import {
  createTestDatabase,
  seedTenant,
  type SeededTenant,
  type TestDatabase,
} from "@image-delivery/test-utils";

import { createApiKeyService, type ApiKeyService } from "../src/modules/api-keys/api-key.service";
import { audited } from "../src/modules/audit/audit";

// P1-07: every security-relevant change writes its audit entry in the same
// transaction, and the application's database role cannot alter the trail.

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

let t: TestDatabase;
let apiKeys: ApiKeyService;
let a: SeededTenant;

const asKey = (tenant: SeededTenant): TenantContext => ({
  ...systemContext(tenant.tenantId, newId()),
  applicationId: tenant.applicationId,
  actor: { type: "api_key", id: newId() },
  permissions: new Set(["api-key:create", "api-key:read", "api-key:update", "api-key:delete"]),
  sourceIp: "203.0.113.7",
});

const entriesFor = (targetId: string) =>
  t.db
    .selectFrom("audit_logs")
    .select(["action", "actor_type", "actor_id", "target_type", "request_id", "ip", "metadata"])
    .where("target_id", "=", targetId)
    .orderBy("id")
    .execute();

const body = {
  name: "ci",
  environment: "live" as const,
  permissions: ["api-key:read" as const],
  all_projects: true,
  project_ids: [],
};

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
  apiKeys = createApiKeyService({ db: t.db, pepper: PEPPER });
  a = await seedTenant(t.db);
});
afterAll(async () => {
  await t.destroy();
});

describe("audited API-key changes", () => {
  it("records create, rotate and revoke with actor, request and address", async () => {
    const ctx = asKey(a);
    const issued = await apiKeys.create(ctx, a.applicationId, body);
    const rotated = await apiKeys.rotate(ctx, a.applicationId, issued.apiKey.id, {});
    await apiKeys.revoke(ctx, a.applicationId, issued.apiKey.id);

    const entries = await entriesFor(issued.apiKey.id);
    expect(entries.map((e) => e.action)).toEqual([
      "api_key.created",
      "api_key.rotated",
      "api_key.revoked",
    ]);
    expect(entries[0]).toMatchObject({
      actor_type: "api_key",
      actor_id: ctx.actor.id,
      target_type: "api_key",
      request_id: ctx.requestId,
      ip: "203.0.113.7",
    });
    expect(entries[1]?.metadata).toMatchObject({ replacement_id: rotated.apiKey.id });
  });

  it("never records the secret or the plaintext", async () => {
    const issued = await apiKeys.create(asKey(a), a.applicationId, body);
    const { rows } = await sql<Record<string, unknown>>`
      select * from audit_logs where target_id = ${issued.apiKey.id}
    `.execute(t.db);

    expect(JSON.stringify(rows)).not.toContain(issued.plaintext.slice(-43));
  });

  it("records a repeated revoke once", async () => {
    const ctx = asKey(a);
    const issued = await apiKeys.create(ctx, a.applicationId, body);
    await apiKeys.revoke(ctx, a.applicationId, issued.apiKey.id);
    await apiKeys.revoke(ctx, a.applicationId, issued.apiKey.id);

    const revokes = (await entriesFor(issued.apiKey.id)).filter(
      (e) => e.action === "api_key.revoked",
    );
    expect(revokes).toHaveLength(1);
  });
});

describe("the change and its record commit together", () => {
  it("writes no entry when the change fails", async () => {
    const ctx = asKey(a);
    const issued = await apiKeys.create(ctx, a.applicationId, body);
    await apiKeys.revoke(ctx, a.applicationId, issued.apiKey.id);

    await expect(apiKeys.rotate(ctx, a.applicationId, issued.apiKey.id, {})).rejects.toThrow();

    const actions = (await entriesFor(issued.apiKey.id)).map((e) => e.action);
    expect(actions).not.toContain("api_key.rotated");
  });

  it("keeps neither the change nor the entry if writing the entry fails", async () => {
    const ctx = asKey(a);
    const renamed = newId();

    await expect(
      audited(t.db, ctx, async (tx) => {
        await tx
          .updateTable("tenants")
          .set({ name: renamed })
          .where("id", "=", a.tenantId)
          .execute();
        // An action outside the database's vocabulary check fails the insert.
        return {
          result: undefined,
          audit: {
            action: "Not An Action" as "admin.access",
            targetType: "tenant",
            targetId: a.tenantId,
          },
        };
      }),
    ).rejects.toThrow(/check constraint/);

    const tenant = await t.db
      .selectFrom("tenants")
      .select("name")
      .where("id", "=", a.tenantId)
      .executeTakeFirstOrThrow();
    expect(tenant.name).not.toBe(renamed);
  });
});

describe("the application's database role (P1-07 DoD)", () => {
  let appDb: ReturnType<typeof createDb>;
  let login: string;
  let entryId: string;

  beforeAll(async () => {
    login = `app_test_${randomBytes(4).toString("hex")}`;
    const password = randomBytes(12).toString("hex");
    await sql`create role ${sql.id(login)} login password ${sql.lit(password)} in role image_delivery_app`.execute(
      t.db,
    );
    const url = new URL(t.url);
    url.username = login;
    url.password = password;
    appDb = createDb({
      url: url.toString(),
      poolMax: 2,
      statementTimeoutMs: 10_000,
      applicationName: "app-role-test",
    });

    const issued = await apiKeys.create(asKey(a), a.applicationId, body);
    entryId = (
      await t.db
        .selectFrom("audit_logs")
        .select("id")
        .where("target_id", "=", issued.apiKey.id)
        .executeTakeFirstOrThrow()
    ).id;
  });
  afterAll(async () => {
    await appDb.destroy();
    await sql`drop role if exists ${sql.id(login)}`.execute(t.db);
  });

  it("may insert and read audit entries", async () => {
    await appDb
      .insertInto("audit_logs")
      .values({
        id: newId(),
        tenant_id: a.tenantId,
        actor_type: "system",
        action: "admin.access",
        target_type: "tenant",
      })
      .execute();

    expect(
      await appDb.selectFrom("audit_logs").select("id").where("id", "=", entryId).execute(),
    ).toHaveLength(1);
  });

  it("has no UPDATE, DELETE or TRUNCATE on audit_logs", async () => {
    await expect(
      appDb
        .updateTable("audit_logs")
        .set({ action: "admin.access" })
        .where("id", "=", entryId)
        .execute(),
    ).rejects.toThrow(/permission denied/);
    await expect(
      appDb.deleteFrom("audit_logs").where("id", "=", entryId).execute(),
    ).rejects.toThrow(/permission denied/);
    await expect(sql`truncate audit_logs`.execute(appDb)).rejects.toThrow(/permission denied/);
  });

  it("can still do its ordinary work on other tables", async () => {
    const updated = await appDb
      .updateTable("api_keys")
      .set({ name: "renamed" })
      .where("tenant_id", "=", a.tenantId)
      .executeTakeFirst();

    expect(updated.numUpdatedRows).toBeGreaterThan(0n);
  });
});
