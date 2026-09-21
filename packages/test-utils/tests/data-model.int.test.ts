import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { newId } from "@image-delivery/schema";

import { createTestDatabase, type TestDatabase } from "../src/database";

// P1-01: the full data model. Two halves:
//  1. the migration-lint (DoD): every table is classified, tenant-owned
//     tables carry tenant_id, and every reference into tenant data is a
//     composite FK -- checked against the live catalog, so a future
//     migration that forgets the rule fails here;
//  2. the integrity rules ADR-022 moved into the schema, each attempted
//     and asserted to be rejected by the named constraint.

/**
 * Every table the platform has, and its scope (docs/DATABASE/00 "Table
 * ownership"). A table missing from this map fails the lint: classify it,
 * and if it is "global", document why in docs/DATABASE/00.
 */
const TABLE_SCOPES: Readonly<Record<string, "global" | "tenant" | "project">> = {
  tenants: "global",
  quotas: "global",
  users: "tenant",
  applications: "tenant",
  projects: "tenant",
  role_assignments: "tenant",
  api_keys: "tenant",
  api_key_projects: "tenant",
  webhooks: "tenant",
  webhook_deliveries: "tenant",
  quota_overrides: "tenant",
  audit_logs: "tenant",
  usage_event_ledger: "tenant",
  usage: "project",
  folders: "project",
  assets: "project",
  asset_versions: "project",
  asset_metadata: "project",
  image_derivatives: "project",
  tags: "project",
  asset_tags: "project",
  collections: "project",
  collection_assets: "project",
  idempotency_keys: "project",
};

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
});
afterAll(async () => {
  await t.destroy();
});

// ==========================================
// MIGRATION LINT
// ==========================================

type Column = { table_name: string; column_name: string; is_nullable: "YES" | "NO" };
type ForeignKey = { table: string; ref: string; name: string; columns: string[] };

const columns = async (): Promise<Column[]> =>
  (
    await sql<Column>`
      select table_name, column_name, is_nullable from information_schema.columns
      where table_schema = 'public'
    `.execute(t.db)
  ).rows;

const foreignKeys = async (): Promise<ForeignKey[]> =>
  (
    await sql<ForeignKey>`
      select c.conrelid::regclass::text as table, c.confrelid::regclass::text as ref,
        c.conname as name,
        array(
          select a.attname from unnest(c.conkey) k
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
        )::text[] as columns
      from pg_constraint c
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    `.execute(t.db)
  ).rows;

describe("migration lint", () => {
  it("classifies every table in the schema, and nothing that does not exist", async () => {
    const { rows } = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
        and table_name not like 'kysely_migration%'
    `.execute(t.db);

    expect(rows.map((r) => r.table_name).sort()).toEqual(Object.keys(TABLE_SCOPES).sort());
  });

  it("gives every tenant- and project-owned table a NOT NULL tenant_id", async () => {
    const cols = await columns();
    const owned = Object.entries(TABLE_SCOPES).filter(([, scope]) => scope !== "global");

    for (const [table] of owned) {
      const tenantId = cols.find((c) => c.table_name === table && c.column_name === "tenant_id");
      expect(tenantId?.is_nullable, `${table}.tenant_id`).toBe("NO");
    }
  });

  it("gives every project-owned table a NOT NULL project_id", async () => {
    const cols = await columns();
    const owned = Object.entries(TABLE_SCOPES).filter(([, scope]) => scope === "project");

    for (const [table] of owned) {
      const projectId = cols.find((c) => c.table_name === table && c.column_name === "project_id");
      expect(projectId?.is_nullable, `${table}.project_id`).toBe("NO");
    }
  });

  it("makes every reference into tenant data a composite FK carrying tenant_id", async () => {
    const offenders = (await foreignKeys())
      .filter((fk) => TABLE_SCOPES[fk.ref] !== "global")
      .filter((fk) => !fk.columns.includes("tenant_id"))
      .map((fk) => `${fk.table}.${fk.name}`);

    expect(offenders).toEqual([]);
  });

  it("makes every reference between project-owned rows carry project_id too", async () => {
    const offenders = (await foreignKeys())
      .filter((fk) => TABLE_SCOPES[fk.table] === "project" && TABLE_SCOPES[fk.ref] === "project")
      .filter((fk) => !fk.columns.includes("project_id"))
      .map((fk) => `${fk.table}.${fk.name}`);

    expect(offenders).toEqual([]);
  });

  it("uses no Postgres enum types (text + CHECK instead)", async () => {
    const { rows } = await sql<{ n: number }>`
      select count(*)::int as n from pg_type t
      join pg_namespace ns on ns.oid = t.typnamespace
      where t.typtype = 'e' and ns.nspname = 'public'
    `.execute(t.db);

    expect(rows[0]?.n).toBe(0);
  });
});

// ==========================================
// INTEGRITY RULES
// ==========================================

type Scope = { tenantId: string; applicationId: string; projectId: string };

let seq = 0;
const seedProject = async (tenantId?: string, applicationId?: string): Promise<Scope> => {
  seq += 1;
  const tenant = tenantId ?? newId();
  if (!tenantId) {
    await t.db
      .insertInto("tenants")
      .values({ id: tenant, name: "t", slug: `t-${seq}` })
      .execute();
  }
  const application = applicationId ?? newId();
  if (!applicationId) {
    await t.db
      .insertInto("applications")
      .values({ id: application, tenant_id: tenant, name: "a", slug: `a-${seq}` })
      .execute();
  }
  const project = newId();
  await t.db
    .insertInto("projects")
    .values({
      id: project,
      tenant_id: tenant,
      application_id: application,
      name: "p",
      slug: `p-${seq}`,
    })
    .execute();
  return { tenantId: tenant, applicationId: application, projectId: project };
};

const insertAsset = async (s: Scope, extra: { folder_id?: string } = {}) => {
  const id = newId();
  await t.db
    .insertInto("assets")
    .values({
      id,
      tenant_id: s.tenantId,
      project_id: s.projectId,
      original_filename: "cat.jpg",
      ...extra,
    })
    .execute();
  return id;
};

const insertVersion = async (s: Scope, assetId: string, versionNumber = 1) => {
  const id = newId();
  await t.db
    .insertInto("asset_versions")
    .values({
      id,
      tenant_id: s.tenantId,
      project_id: s.projectId,
      asset_id: assetId,
      version_number: versionNumber,
      storage_key: `${s.tenantId}/${s.projectId}/originals/${assetId}/${id}.jpg`,
    })
    .execute();
  return id;
};

const insertFolder = async (s: Scope, path: string, parentId: string | null = null) => {
  const id = newId();
  const segments = path.split("/").filter(Boolean);
  await t.db
    .insertInto("folders")
    .values({
      id,
      tenant_id: s.tenantId,
      project_id: s.projectId,
      parent_id: parentId,
      name: segments.at(-1) ?? "x",
      path,
      depth: segments.length,
    })
    .execute();
  return id;
};

describe("same-project integrity (ADR-022 point 2)", () => {
  it("rejects an asset in another project's folder, even within one tenant", async () => {
    const a = await seedProject();
    const b = await seedProject(a.tenantId, a.applicationId);
    const folderInB = await insertFolder(b, "/photos");

    await expect(insertAsset(a, { folder_id: folderInB })).rejects.toThrow(/assets_folder_fk/);
  });

  it("rejects a current-version pointer at another asset's version", async () => {
    const s = await seedProject();
    const one = await insertAsset(s);
    const two = await insertAsset(s);
    const versionOfTwo = await insertVersion(s, two);

    await expect(
      t.db
        .updateTable("assets")
        .set({ current_version_id: versionOfTwo })
        .where("id", "=", one)
        .execute(),
    ).rejects.toThrow(/assets_current_version_fk/);
  });

  it("accepts a pointer at the asset's own version", async () => {
    const s = await seedProject();
    const asset = await insertAsset(s);
    const version = await insertVersion(s, asset);

    await t.db
      .updateTable("assets")
      .set({ current_version_id: version })
      .where("id", "=", asset)
      .execute();
  });

  it("rejects tagging an asset with another project's tag", async () => {
    const a = await seedProject();
    const b = await seedProject(a.tenantId, a.applicationId);
    const asset = await insertAsset(a);
    const tagInB = newId();
    await t.db
      .insertInto("tags")
      .values({ id: tagInB, tenant_id: b.tenantId, project_id: b.projectId, name: "beach" })
      .execute();

    await expect(
      t.db
        .insertInto("asset_tags")
        .values({ tenant_id: a.tenantId, project_id: a.projectId, asset_id: asset, tag_id: tagInB })
        .execute(),
    ).rejects.toThrow(/asset_tags_tag_fk/);
  });

  it("refuses to purge an asset that is still in a collection", async () => {
    const s = await seedProject();
    const asset = await insertAsset(s);
    const collection = newId();
    await t.db
      .insertInto("collections")
      .values({ id: collection, tenant_id: s.tenantId, project_id: s.projectId, name: "Best" })
      .execute();
    await t.db
      .insertInto("collection_assets")
      .values({
        tenant_id: s.tenantId,
        project_id: s.projectId,
        collection_id: collection,
        asset_id: asset,
        position: 0,
      })
      .execute();

    await expect(t.db.deleteFrom("assets").where("id", "=", asset).execute()).rejects.toThrow(
      /collection_assets_asset_fk/,
    );
  });
});

describe("asset rules", () => {
  it("rejects a visibility level outside the five defined ones (fails closed)", async () => {
    const s = await seedProject();
    const id = await insertAsset(s);

    await expect(
      t.db
        .updateTable("assets")
        .set({ visibility: "internal" as "private" })
        .where("id", "=", id)
        .execute(),
    ).rejects.toThrow(/check constraint/);
  });

  it("defaults a new asset to pending and private", async () => {
    const s = await seedProject();
    const id = await insertAsset(s);

    const row = await t.db
      .selectFrom("assets")
      .select(["status", "visibility"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: "pending", visibility: "private" });
  });

  it("refuses to mark a version ready without its bytes-derived facts", async () => {
    const s = await seedProject();
    const version = await insertVersion(s, await insertAsset(s));

    await expect(
      t.db
        .updateTable("asset_versions")
        .set({ status: "ready" })
        .where("id", "=", version)
        .execute(),
    ).rejects.toThrow(/asset_versions_ready_ck/);
  });

  it("numbers versions uniquely per asset", async () => {
    const s = await seedProject();
    const asset = await insertAsset(s);
    await insertVersion(s, asset, 1);

    await expect(insertVersion(s, asset, 1)).rejects.toThrow(/asset_versions_number_uk/);
  });

  it("allows one derivative per (version, params_hash)", async () => {
    const s = await seedProject();
    const version = await insertVersion(s, await insertAsset(s));
    const derivative = (key: string) => ({
      id: newId(),
      tenant_id: s.tenantId,
      project_id: s.projectId,
      asset_version_id: version,
      params_hash: "0123456789abcdef",
      canonical_params: "f=webp&w=800",
      format: "webp" as const,
      storage_key: key,
    });
    await t.db.insertInto("image_derivatives").values(derivative("k1")).execute();

    await expect(
      t.db.insertInto("image_derivatives").values(derivative("k2")).execute(),
    ).rejects.toThrow(/image_derivatives_identity_uk/);
  });
});

describe("folders, tags and collections", () => {
  it("requires a root folder to have depth 1 and a child to have a parent", async () => {
    const s = await seedProject();

    await expect(insertFolder(s, "/a/b")).rejects.toThrow(/folders_root_depth_ck/);
  });

  it("keeps folder paths unique among live folders, case-insensitively", async () => {
    const s = await seedProject();
    const first = await insertFolder(s, "/Photos");

    await expect(insertFolder(s, "/photos")).rejects.toThrow(/folders_path_uk/);

    await t.db
      .updateTable("folders")
      .set({ deleted_at: new Date() })
      .where("id", "=", first)
      .execute();
    await insertFolder(s, "/photos");
  });

  it("treats tag names case-insensitively and requires them trimmed", async () => {
    const s = await seedProject();
    const tag = (name: string) =>
      t.db
        .insertInto("tags")
        .values({ id: newId(), tenant_id: s.tenantId, project_id: s.projectId, name })
        .execute();
    await tag("Beach");

    await expect(tag("beach")).rejects.toThrow(/tags_name_uk/);
    await expect(tag(" sunset")).rejects.toThrow(/check constraint/);
  });
});

describe("access", () => {
  it("rejects a key covering a project of another application", async () => {
    const a = await seedProject();
    const otherApp = await seedProject(a.tenantId);
    const key = newId();
    await t.db
      .insertInto("api_keys")
      .values({
        id: key,
        tenant_id: a.tenantId,
        application_id: a.applicationId,
        name: "ci",
        environment: "live",
        key_hash: "a".repeat(64),
        permissions: ["asset:read"],
      })
      .execute();

    await expect(
      t.db
        .insertInto("api_key_projects")
        .values({
          tenant_id: a.tenantId,
          application_id: a.applicationId,
          api_key_id: key,
          project_id: otherApp.projectId,
        })
        .execute(),
    ).rejects.toThrow(/api_key_projects_project_fk/);
  });

  it("requires revoked_at exactly when a key is revoked", async () => {
    const s = await seedProject();
    const key = newId();
    await t.db
      .insertInto("api_keys")
      .values({
        id: key,
        tenant_id: s.tenantId,
        application_id: s.applicationId,
        name: "ci",
        environment: "test",
        key_hash: "b".repeat(64),
        permissions: ["asset:read"],
      })
      .execute();

    await expect(
      t.db.updateTable("api_keys").set({ status: "revoked" }).where("id", "=", key).execute(),
    ).rejects.toThrow(/api_keys_revoked_ck/);
  });

  it("allows one role grant per user per scope, the application scope included", async () => {
    const s = await seedProject();
    const user = newId();
    await t.db
      .insertInto("users")
      .values({
        id: user,
        tenant_id: s.tenantId,
        email: `u${newId()}@example.com`,
        display_name: "U",
        role: "viewer",
      })
      .execute();
    const grant = () =>
      t.db
        .insertInto("role_assignments")
        .values({
          id: newId(),
          tenant_id: s.tenantId,
          user_id: user,
          role: "developer",
          application_id: s.applicationId,
          project_id: null,
        })
        .execute();
    await grant();

    await expect(grant()).rejects.toThrow(/role_assignments_scope_uk/);
  });
});

describe("platform tables", () => {
  it("rejects a webhook subscribed to an unknown event", async () => {
    const s = await seedProject();

    await expect(
      t.db
        .insertInto("webhooks")
        .values({
          id: newId(),
          tenant_id: s.tenantId,
          application_id: s.applicationId,
          url: "https://hooks.example.com/in",
          events: ["asset.uploaded", "asset.exploded" as "asset.uploaded"],
          secret_ciphertext: Buffer.from("ciphertext"),
        })
        .execute(),
    ).rejects.toThrow(/check constraint/);
  });

  it("returns a usage day as the calendar day, independent of the server's time zone", async () => {
    const s = await seedProject();
    await t.db
      .insertInto("usage")
      .values({
        tenant_id: s.tenantId,
        application_id: s.applicationId,
        project_id: s.projectId,
        metric: "requests",
        day: "2026-09-21",
        value: 42,
      })
      .execute();

    const row = await t.db
      .selectFrom("usage")
      .select(["day", "value"])
      .where("project_id", "=", s.projectId)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ day: "2026-09-21", value: 42 });
  });
});

describe("audit_logs is append-only in the database (ADR-022 point 12)", () => {
  const writeEntry = async (tenantId: string) => {
    const id = newId();
    await t.db
      .insertInto("audit_logs")
      .values({
        id,
        tenant_id: tenantId,
        actor_type: "user",
        actor_id: newId(),
        action: "api_key.revoked",
        target_type: "api_key",
        target_id: newId(),
      })
      .execute();
    return id;
  };

  it("rejects an UPDATE", async () => {
    const { tenantId } = await seedProject();
    const id = await writeEntry(tenantId);

    await expect(
      t.db
        .updateTable("audit_logs")
        .set({ action: "api_key.created" })
        .where("id", "=", id)
        .execute(),
    ).rejects.toThrow(/append-only/);
  });

  it("rejects a DELETE and a TRUNCATE outside the retention purge", async () => {
    const { tenantId } = await seedProject();
    const id = await writeEntry(tenantId);

    await expect(t.db.deleteFrom("audit_logs").where("id", "=", id).execute()).rejects.toThrow(
      /retention purge/,
    );
    await expect(sql`truncate audit_logs`.execute(t.db)).rejects.toThrow(/retention purge/);
  });

  it("allows the retention purge to delete, inside its own transaction only", async () => {
    const { tenantId } = await seedProject();
    const id = await writeEntry(tenantId);

    await t.db.transaction().execute(async (tx) => {
      await sql`select set_config('image_delivery.audit_purge', 'on', true)`.execute(tx);
      await tx.deleteFrom("audit_logs").where("id", "=", id).execute();
    });

    const left = await t.db.selectFrom("audit_logs").select("id").where("id", "=", id).execute();
    expect(left).toEqual([]);
    // The setting was transaction-local: a later delete is refused again.
    const other = await writeEntry(tenantId);
    await expect(t.db.deleteFrom("audit_logs").where("id", "=", other).execute()).rejects.toThrow(
      /retention purge/,
    );
  });

  it("rejects an action outside the dotted vocabulary", async () => {
    const { tenantId } = await seedProject();

    await expect(
      t.db
        .insertInto("audit_logs")
        .values({
          id: newId(),
          tenant_id: tenantId,
          actor_type: "system",
          action: "Deleted Everything",
          target_type: "asset",
        })
        .execute(),
    ).rejects.toThrow(/check constraint/);
  });
});
