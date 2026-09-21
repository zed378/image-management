import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createLogger } from "@image-delivery/logger";
import { systemContext } from "@image-delivery/tenancy";
import {
  createTestDatabase,
  seedApplication,
  seedTenant,
  type SeededTenant,
  type TestDatabase,
} from "@image-delivery/test-utils";

import { buildApp } from "../src/app";
import { createApiKeyService, type ApiKeyService } from "../src/modules/api-keys/api-key.service";

import type { FastifyInstance } from "fastify";

// P1-03 end to end: the key-management routes over HTTP against a real
// database -- authentication, permission, application scope, no privilege
// escalation, and the cross-tenant 404 on every :id route (CLAUDE.md, SEC-TEN-03).

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";
const ALL = ["api-key:create", "api-key:read", "api-key:update", "api-key:delete"];

let t: TestDatabase;
let apiKeys: ApiKeyService;
let app: FastifyInstance;
let a: SeededTenant;
let b: SeededTenant;
let adminA: string;
let adminB: string;

const issue = async (tenant: SeededTenant, permissions: string[], applicationId?: string) =>
  apiKeys.create(systemContext(tenant.tenantId), applicationId ?? tenant.applicationId, {
    name: "fixture",
    environment: "live",
    permissions,
    all_projects: true,
    project_ids: [],
  });

const call = (key: string, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${key}` },
    ...(payload ? { payload } : {}),
  });

const codeOf = (res: Awaited<ReturnType<FastifyInstance["inject"]>>) =>
  res.json<{ error: { code: string } }>().error.code;

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
  apiKeys = createApiKeyService({ db: t.db, pepper: PEPPER });
  app = await buildApp({
    logger: createLogger({ service: "api", version: "test", level: "silent" }),
    readinessChecks: {},
    apiKeys,
  });
  a = await seedTenant(t.db);
  b = await seedTenant(t.db);
  adminA = (await issue(a, ALL)).plaintext;
  adminB = (await issue(b, ALL)).plaintext;
});
afterAll(async () => {
  await app.close();
  await t.destroy();
});

describe("managing keys over HTTP", () => {
  it("issues a key (201, Location, plaintext once) that then authenticates", async () => {
    const res = await call(adminA, "POST", `/v1/applications/${a.applicationId}/api-keys`, {
      name: "deploy",
      environment: "live",
      permissions: ["api-key:read"],
      all_projects: true,
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: { id: string; key: string; prefix: string } }>();
    expect(res.headers.location).toBe(`/v1/applications/${a.applicationId}/api-keys/${data.id}`);
    expect(data.key.startsWith(`${data.prefix}_`)).toBe(true);

    const listed = await call(data.key, "GET", `/v1/applications/${a.applicationId}/api-keys`);
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain(data.key.slice(-43));
  });

  it("rejects an invalid body with 400 and field-level details", async () => {
    const res = await call(adminA, "POST", `/v1/applications/${a.applicationId}/api-keys`, {
      name: "x",
      environment: "prod",
      permissions: [],
    });

    expect(res.statusCode).toBe(400);
    expect(codeOf(res)).toBe("validation_failed");
  });

  it("rotates and revokes over HTTP", async () => {
    const victim = await issue(a, ["api-key:read"]);

    const rotated = await call(
      adminA,
      "POST",
      `/v1/applications/${a.applicationId}/api-keys/${victim.apiKey.id}/rotate`,
      { overlap_seconds: 0 },
    );
    expect(rotated.statusCode).toBe(201);

    const revoked = await call(
      adminA,
      "POST",
      `/v1/applications/${a.applicationId}/api-keys/${victim.apiKey.id}/revoke`,
    );
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json<{ data: { status: string } }>().data.status).toBe("revoked");

    const after = await call(
      victim.plaintext,
      "GET",
      `/v1/applications/${a.applicationId}/api-keys`,
    );
    expect(after.statusCode).toBe(401);
  });
});

describe("tenant isolation on every :id route (SEC-TEN-03)", () => {
  it.each([
    ["GET", ""],
    ["POST", "/rotate"],
    ["POST", "/revoke"],
  ] as const)("%s /api-keys/:id%s answers 404 for another tenant's key", async (method, suffix) => {
    const victim = await issue(a, ["api-key:read"]);

    // Tenant B's admin, naming A's application and A's key.
    const viaForeignApp = await call(
      adminB,
      method,
      `/v1/applications/${a.applicationId}/api-keys/${victim.apiKey.id}${suffix}`,
      method === "POST" ? {} : undefined,
    );
    // Tenant B's admin, naming its own application and A's key.
    const viaOwnApp = await call(
      adminB,
      method,
      `/v1/applications/${b.applicationId}/api-keys/${victim.apiKey.id}${suffix}`,
      method === "POST" ? {} : undefined,
    );

    expect(viaForeignApp.statusCode).toBe(404);
    expect(viaOwnApp.statusCode).toBe(404);
    expect(codeOf(viaOwnApp)).toBe("api_key_not_found");
    // Unchanged: A's key still works.
    expect(await apiKeys.authenticate(victim.plaintext)).not.toBeNull();
  });

  it("answers 404 to a list of another tenant's application", async () => {
    const res = await call(adminB, "GET", `/v1/applications/${a.applicationId}/api-keys`);

    expect(res.statusCode).toBe(404);
    expect(codeOf(res)).toBe("application_not_found");
  });

  it("confines a key to its own application within the tenant", async () => {
    const other = await seedApplication(t.db, a.tenantId);
    await issue(a, ["api-key:read"], other.applicationId);

    const res = await call(adminA, "GET", `/v1/applications/${other.applicationId}/api-keys`);

    expect(res.statusCode).toBe(404);
  });
});

describe("no privilege escalation through key management", () => {
  it("refuses to issue a key with a permission the caller lacks", async () => {
    const limited = await issue(a, ["api-key:create", "api-key:read"]);

    const res = await call(
      limited.plaintext,
      "POST",
      `/v1/applications/${a.applicationId}/api-keys`,
      {
        name: "escalate",
        environment: "live",
        permissions: ["api-key:read", "api-key:delete"],
        all_projects: true,
      },
    );

    expect(res.statusCode).toBe(403);
    expect(codeOf(res)).toBe("permission_denied");
  });

  it("refuses to rotate a key more powerful than the caller (it would hand back its plaintext)", async () => {
    const limited = await issue(a, ["api-key:update"]);
    const powerful = await issue(a, ALL);

    const res = await call(
      limited.plaintext,
      "POST",
      `/v1/applications/${a.applicationId}/api-keys/${powerful.apiKey.id}/rotate`,
      {},
    );

    expect(res.statusCode).toBe(403);
    expect(codeOf(res)).toBe("permission_denied");
  });

  it("refuses all_projects from a caller limited to some projects", async () => {
    const scoped = await apiKeys.create(systemContext(a.tenantId), a.applicationId, {
      name: "scoped",
      environment: "live",
      permissions: ["api-key:create"],
      all_projects: false,
      project_ids: [a.projectId],
    });

    const res = await call(
      scoped.plaintext,
      "POST",
      `/v1/applications/${a.applicationId}/api-keys`,
      {
        name: "wider",
        environment: "live",
        permissions: ["api-key:create"],
        all_projects: true,
      },
    );

    expect(res.statusCode).toBe(403);
  });
});
