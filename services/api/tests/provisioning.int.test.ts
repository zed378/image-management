import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "@image-delivery/test-utils";

import { createApiKeyService } from "../src/modules/api-keys/api-key.service";
import { provisionTenant } from "../src/modules/tenancy/tenancy.provisioning";

// The operator bootstrap (src/provision.ts): a fresh installation's only
// way to its first API key.

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
});
afterAll(async () => {
  await t.destroy();
});

describe("provisionTenant", () => {
  it("creates the tenancy chain and a working bootstrap key", async () => {
    const apiKeys = createApiKeyService({ db: t.db, pepper: PEPPER });

    const result = await provisionTenant(t.db, apiKeys, {
      tenantName: "Acme",
      tenantSlug: "acme",
      applicationSlug: "default",
      projectSlug: "production",
      keyPermissions: ["api-key:read"],
    });

    expect(await apiKeys.authenticate(result.apiKey)).toEqual({
      keyId: result.apiKeyId,
      tenantId: result.tenantId,
      applicationId: result.applicationId,
      permissions: ["api-key:read"],
      projectAccess: "all",
    });
    const project = await t.db
      .selectFrom("projects")
      .select(["tenant_id", "application_id", "slug"])
      .where("id", "=", result.projectId)
      .executeTakeFirstOrThrow();
    expect(project).toEqual({
      tenant_id: result.tenantId,
      application_id: result.applicationId,
      slug: "production",
    });
  });

  it("refuses a slug that is taken, leaving no partial tenant", async () => {
    const apiKeys = createApiKeyService({ db: t.db, pepper: PEPPER });
    const input = {
      tenantName: "Dup",
      tenantSlug: "dup",
      applicationSlug: "default",
      projectSlug: "production",
      keyPermissions: ["api-key:read" as const],
    };
    await provisionTenant(t.db, apiKeys, input);

    await expect(provisionTenant(t.db, apiKeys, input)).rejects.toThrow(/tenants_slug_key/);
    const count = await t.db
      .selectFrom("tenants")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("slug", "=", "dup")
      .executeTakeFirstOrThrow();
    expect(count.n).toBe(1);
  });
});
