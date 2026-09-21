import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { migrateDownOne, migrateToLatest, migrationNames } from "@image-delivery/db";
import { newId } from "@image-delivery/schema";

import { createTestDatabase, type TestDatabase } from "../src/database";

// Lives in test-utils rather than packages/db: test-utils depends on db, so a
// db test depending on test-utils would be a package cycle (which Turborepo
// rejects). Rule: a package test-utils depends on never depends on test-utils.

// P0-06 Definition of Done: migrations apply from empty, and rollback of the
// latest migration is tested rather than assumed.

const tableNames = async (t: TestDatabase): Promise<string[]> => {
  const { rows } = await sql<{ table_name: string }>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `.execute(t.db);
  return rows.map((r) => r.table_name);
};

describe("migrations", () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase(inject("postgresAdminUrl"), { migrate: false });
  });
  afterAll(async () => {
    await t.destroy();
  });

  it("apply cleanly from an empty database", async () => {
    const outcome = await migrateToLatest(t.db);

    expect(outcome.applied).toEqual(migrationNames());
    expect(await tableNames(t)).toEqual(
      expect.arrayContaining(["applications", "projects", "tenants", "users"]),
    );
  });

  it("are idempotent: a second run applies nothing", async () => {
    const outcome = await migrateToLatest(t.db);

    expect(outcome.applied).toEqual([]);
  });

  it("roll back the latest migration, then re-apply it", async () => {
    const latest = migrationNames().at(-1);

    const down = await migrateDownOne(t.db);
    expect(down.applied).toEqual([latest]);

    const up = await migrateToLatest(t.db);
    expect(up.applied).toEqual([latest]);
  });
});

describe("tenancy chain schema", () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase(inject("postgresAdminUrl"));
  });
  afterAll(async () => {
    await t.destroy();
  });

  const seedTenant = async (slug: string) => {
    const tenantId = newId();
    await t.db.insertInto("tenants").values({ id: tenantId, name: slug, slug }).execute();
    const applicationId = newId();
    await t.db
      .insertInto("applications")
      .values({ id: applicationId, tenant_id: tenantId, name: "app", slug: "app" })
      .execute();
    return { tenantId, applicationId };
  };

  it("rejects a project whose tenant disagrees with its application's tenant", async () => {
    // The composite foreign key (application_id, tenant_id) makes a
    // cross-tenant parent/child mismatch unrepresentable.
    const a = await seedTenant("tenant-a");
    const b = await seedTenant("tenant-b");

    await expect(
      t.db
        .insertInto("projects")
        .values({
          id: newId(),
          tenant_id: b.tenantId,
          application_id: a.applicationId,
          name: "p",
          slug: "p",
        })
        .execute(),
    ).rejects.toThrow(/projects_application_fk/);
  });

  it("accepts a project consistent with its application", async () => {
    const a = await seedTenant("tenant-c");

    await t.db
      .insertInto("projects")
      .values({
        id: newId(),
        tenant_id: a.tenantId,
        application_id: a.applicationId,
        name: "p",
        slug: "p",
      })
      .execute();

    const rows = await t.db
      .selectFrom("projects")
      .select(["settings", "status"])
      .where("tenant_id", "=", a.tenantId)
      .execute();
    expect(rows).toEqual([{ settings: {}, status: "active" }]);
  });

  it("rejects an id that is not a ULID", async () => {
    await expect(
      t.db
        .insertInto("tenants")
        .values({ id: "not-a-ulid-at-all-00000000", name: "x", slug: "x" })
        .execute(),
    ).rejects.toThrow(/check constraint/);
  });

  it("rejects an invalid slug", async () => {
    await expect(
      t.db.insertInto("tenants").values({ id: newId(), name: "x", slug: "Has Spaces" }).execute(),
    ).rejects.toThrow(/check constraint/);
  });

  it("treats user email as case-insensitive and unique", async () => {
    const a = await seedTenant("tenant-d");
    const user = { tenant_id: a.tenantId, display_name: "U", role: "owner" as const };
    await t.db
      .insertInto("users")
      .values({ ...user, id: newId(), email: "Ops@Example.com" })
      .execute();

    await expect(
      t.db
        .insertInto("users")
        .values({ ...user, id: newId(), email: "ops@example.com" })
        .execute(),
    ).rejects.toThrow(/users_email_key/);
  });

  it("maintains updated_at on update", async () => {
    const { tenantId } = await seedTenant("tenant-e");
    const before = await t.db
      .selectFrom("tenants")
      .select("updated_at")
      .where("id", "=", tenantId)
      .executeTakeFirstOrThrow();
    await sql`select pg_sleep(0.01)`.execute(t.db);

    await t.db.updateTable("tenants").set({ name: "renamed" }).where("id", "=", tenantId).execute();

    const after = await t.db
      .selectFrom("tenants")
      .select("updated_at")
      .where("id", "=", tenantId)
      .executeTakeFirstOrThrow();
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });

  it("refuses to delete a tenant that still owns applications", async () => {
    const { tenantId } = await seedTenant("tenant-f");

    await expect(t.db.deleteFrom("tenants").where("id", "=", tenantId).execute()).rejects.toThrow(
      /foreign key/,
    );
  });
});
