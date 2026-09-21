import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { AppError } from "@image-delivery/errors";
import { systemContext, type TenantContext } from "@image-delivery/tenancy";
import {
  createTestDatabase,
  seedApplication,
  seedProject,
  seedTenant,
  type SeededTenant,
  type TestDatabase,
} from "@image-delivery/test-utils";

import { createCredentialLookup } from "../src/modules/api-keys/api-key.authentication";
import { parseApiKey } from "../src/modules/api-keys/api-key.crypto";
import { createApiKeyService, type ApiKeyService } from "../src/modules/api-keys/api-key.service";
import { createLastUsedTracker } from "../src/modules/api-keys/last-used-tracker";

import type { CreateApiKeyBody } from "../src/modules/api-keys/api-key.schema";

// P1-02: API-key issuance, rotation, revocation and verification against a
// real database. Definition of Done:
//   - no code path can retrieve a plaintext key after creation (the DB row is
//     inspected directly);
//   - a revoked key immediately fails authentication.

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

let t: TestDatabase;
let clock: Date;
let service: ApiKeyService;
let a: SeededTenant;
let ctxA: TenantContext;

const body = (overrides: Partial<CreateApiKeyBody> = {}): CreateApiKeyBody => ({
  name: "ci",
  environment: "live",
  permissions: ["asset:read"],
  all_projects: true,
  project_ids: [],
  ...overrides,
});

const codeOf = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err.code;
    throw err;
  }
  throw new Error("expected an AppError");
};

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
  clock = new Date("2026-09-21T12:00:00Z");
  service = createApiKeyService({ db: t.db, pepper: PEPPER, now: () => clock });
  a = await seedTenant(t.db);
  ctxA = systemContext(a.tenantId);
});
afterAll(async () => {
  await t.destroy();
});

describe("issuing a key (P1-02 DoD: the plaintext exists once)", () => {
  it("returns the plaintext at creation and stores only a keyed hash", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    const secret = parseApiKey(issued.plaintext)?.secret ?? "";

    // The row, read raw -- every column, every byte.
    const { rows } = await sql<Record<string, unknown>>`
      select * from api_keys where id = ${issued.apiKey.id}
    `.execute(t.db);
    const raw = JSON.stringify(rows);
    expect(secret).toHaveLength(43);
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain(issued.plaintext);
    expect(rows[0]?.["key_hash"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never returns the plaintext or the hash from any read", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    const { rows } = await sql<{ key_hash: string }>`
      select key_hash from api_keys where id = ${issued.apiKey.id}
    `.execute(t.db);
    const hash = rows[0]?.key_hash ?? "";
    const secret = parseApiKey(issued.plaintext)?.secret ?? "";

    const reads = JSON.stringify([
      await service.get(ctxA, a.applicationId, issued.apiKey.id),
      await service.list(ctxA, a.applicationId),
      issued.apiKey,
    ]);
    expect(reads).not.toContain(secret);
    expect(reads).not.toContain(hash);
    expect(reads).toContain(issued.apiKey.prefix);
  });

  it("scopes a key to listed projects of its own application", async () => {
    const second = await seedProject(t.db, a);
    const issued = await service.create(
      ctxA,
      a.applicationId,
      body({ all_projects: false, project_ids: [a.projectId, second].sort() }),
    );

    expect(issued.apiKey.projectAccess).toEqual([a.projectId, second].sort());
    const principal = await service.authenticate(issued.plaintext);
    expect(principal?.projectAccess).toEqual([a.projectId, second].sort());
  });

  it("refuses a project of another application, as not found", async () => {
    const other = await seedApplication(t.db, a.tenantId);

    expect(
      await codeOf(
        service.create(
          ctxA,
          a.applicationId,
          body({ all_projects: false, project_ids: [other.projectId] }),
        ),
      ),
    ).toBe("project_not_found");
  });

  it("refuses an application of another tenant, as not found", async () => {
    const b = await seedTenant(t.db);

    expect(await codeOf(service.create(ctxA, b.applicationId, body()))).toBe(
      "application_not_found",
    );
  });
});

describe("authenticating", () => {
  it("returns the principal the key proves", async () => {
    const issued = await service.create(
      ctxA,
      a.applicationId,
      body({ permissions: ["asset:read", "asset:create"] }),
    );

    expect(await service.authenticate(issued.plaintext)).toEqual({
      keyId: issued.apiKey.id,
      tenantId: a.tenantId,
      applicationId: a.applicationId,
      permissions: ["asset:read", "asset:create"],
      projectAccess: "all",
    });
  });

  it("answers null for every failure alike (SEC-AUTH-04)", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    const parsed = parseApiKey(issued.plaintext);
    const wrongSecret =
      issued.plaintext.slice(0, -1) + (issued.plaintext.endsWith("A") ? "B" : "A");
    const unknownId = `ak_live_01HZZZZZZZZZZZZZZZZZZZZZZZ_${parsed?.secret ?? ""}`;
    const wrongEnvironment = issued.plaintext.replace("ak_live_", "ak_test_");

    for (const presented of [wrongSecret, unknownId, wrongEnvironment, "garbage", ""]) {
      expect(await service.authenticate(presented), presented).toBeNull();
    }
  });

  it("rejects a key of a suspended application or tenant", async () => {
    const b = await seedTenant(t.db);
    const ctxB = systemContext(b.tenantId);
    const issued = await service.create(ctxB, b.applicationId, body());

    await t.db
      .updateTable("applications")
      .set({ status: "suspended" })
      .where("id", "=", b.applicationId)
      .execute();
    expect(await service.authenticate(issued.plaintext)).toBeNull();

    await t.db
      .updateTable("applications")
      .set({ status: "active" })
      .where("id", "=", b.applicationId)
      .execute();
    await t.db
      .updateTable("tenants")
      .set({ status: "suspended" })
      .where("id", "=", b.tenantId)
      .execute();
    expect(await service.authenticate(issued.plaintext)).toBeNull();
  });
});

describe("revocation (P1-02 DoD: immediate)", () => {
  it("makes the very next authentication fail", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    expect(await service.authenticate(issued.plaintext)).not.toBeNull();

    const revoked = await service.revoke(ctxA, a.applicationId, issued.apiKey.id);

    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(await service.authenticate(issued.plaintext)).toBeNull();
  });

  it("is idempotent", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    const first = await service.revoke(ctxA, a.applicationId, issued.apiKey.id);

    const second = await service.revoke(ctxA, a.applicationId, issued.apiKey.id);

    expect(second.revokedAt).toEqual(first.revokedAt);
  });
});

describe("rotation", () => {
  it("issues a working replacement and retires the old key after the overlap", async () => {
    const old = await service.create(ctxA, a.applicationId, body({ name: "deploy" }));

    const next = await service.rotate(ctxA, a.applicationId, old.apiKey.id, {
      overlap_seconds: 3600,
    });

    expect(next.apiKey).toMatchObject({
      name: "deploy",
      permissions: ["asset:read"],
      projectAccess: "all",
    });
    expect(next.plaintext).not.toBe(old.plaintext);
    expect(await service.authenticate(next.plaintext)).not.toBeNull();
    expect(await service.authenticate(old.plaintext)).not.toBeNull();

    clock = new Date(clock.getTime() + 3600 * 1000);
    expect(await service.authenticate(old.plaintext)).toBeNull();
    expect(await service.authenticate(next.plaintext)).not.toBeNull();
  });

  it("refuses to rotate a revoked key", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    await service.revoke(ctxA, a.applicationId, issued.apiKey.id);

    expect(await codeOf(service.rotate(ctxA, a.applicationId, issued.apiKey.id, {}))).toBe(
      "invalid_state",
    );
  });
});

describe("tenant isolation (SEC-TEN-03)", () => {
  it("answers not found for another tenant's key id, and changes nothing", async () => {
    const issued = await service.create(ctxA, a.applicationId, body());
    const b = await seedTenant(t.db);
    const ctxB = systemContext(b.tenantId);

    expect(await codeOf(service.get(ctxB, a.applicationId, issued.apiKey.id))).toBe(
      "api_key_not_found",
    );
    expect(await codeOf(service.get(ctxB, b.applicationId, issued.apiKey.id))).toBe(
      "api_key_not_found",
    );
    expect(await codeOf(service.revoke(ctxB, a.applicationId, issued.apiKey.id))).toBe(
      "api_key_not_found",
    );
    expect(await service.list(ctxB, a.applicationId)).toEqual([]);
    expect(await service.authenticate(issued.plaintext)).not.toBeNull();
  });
});

describe("last_used_at (P1-02 step 4)", () => {
  it("is written by the tracker's flush, not by authentication itself", async () => {
    const lookup = createCredentialLookup(t.db);
    const tracker = createLastUsedTracker(lookup.recordUse, { now: () => clock });
    const tracked = createApiKeyService({
      db: t.db,
      pepper: PEPPER,
      now: () => clock,
      lastUsed: tracker,
    });
    const issued = await tracked.create(ctxA, a.applicationId, body());

    await tracked.authenticate(issued.plaintext);
    expect((await tracked.get(ctxA, a.applicationId, issued.apiKey.id)).lastUsedAt).toBeNull();

    await tracker.flush();
    expect((await tracked.get(ctxA, a.applicationId, issued.apiKey.id)).lastUsedAt).toEqual(clock);
  });
});
