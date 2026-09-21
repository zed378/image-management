import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import { describe, expect, it } from "vitest";

import { scoped, ScopeError, unsafeUnscoped } from "./scoped";

import type { Database } from "./types";

// The compiled SQL of scoped() builders, without a database: the properties
// docs/ENGINEERING/07 lists, checked on the statement that would run.
// Behavior against real rows: packages/test-utils/tests/scoped.int.test.ts.

const db = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (k) => new PostgresIntrospector(k),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

const T = "01HZZZZZZZZZZZZZZZZZZZZZT1";
const P = "01HZZZZZZZZZZZZZZZZZZZZZP1";
const OTHER = "01HZZZZZZZZZZZZZZZZZZZZZT2";

const tenantScope = scoped(db, { tenantId: T, projectId: null });
const projectScope = scoped(db, { tenantId: T, projectId: P });

describe("scoped() compiles the scope into every statement", () => {
  it("adds tenant_id to a SELECT on a tenant-level table", () => {
    const q = tenantScope.selectFrom("api_keys").select("id").compile();

    expect(q.sql).toBe('select "id" from "api_keys" where "api_keys"."tenant_id" = $1');
    expect(q.parameters).toEqual([T]);
  });

  it("adds tenant_id and project_id to a SELECT on a project-owned table", () => {
    const q = projectScope.selectFrom("assets").select("id").compile();

    expect(q.sql).toContain('"assets"."tenant_id" = $1 and "assets"."project_id" = $2');
    expect(q.parameters).toEqual([T, P]);
  });

  it("ANDs the scope with a caller's own tenant filter, so a foreign id matches nothing", () => {
    const q = tenantScope
      .selectFrom("api_keys")
      .select("id")
      .where("tenant_id", "=", OTHER)
      .compile();

    expect(q.sql).toBe(
      'select "id" from "api_keys" where "tenant_id" = $1 and "api_keys"."tenant_id" = $2',
    );
    expect(q.parameters).toEqual([OTHER, T]);
  });

  it("survives clearWhere(): the predicate is added after the builder is done", () => {
    const q = tenantScope
      .selectFrom("api_keys")
      .select("id")
      .where("id", "=", "x")
      .clearWhere()
      .compile();

    expect(q.sql).toBe('select "id" from "api_keys" where "api_keys"."tenant_id" = $1');
  });

  it("scopes UPDATE and DELETE", () => {
    const update = tenantScope.updateTable("api_keys").set({ name: "n" }).compile();
    const del = projectScope.deleteFrom("asset_tags").compile();

    expect(update.sql).toContain('where "api_keys"."tenant_id" = $2');
    expect(del.sql).toBe(
      'delete from "asset_tags" where "asset_tags"."tenant_id" = $1 and "asset_tags"."project_id" = $2',
    );
  });

  it("stamps INSERT with the context's ids, overwriting any in the payload", () => {
    const q = projectScope
      .insertInto("tags", {
        id: "01HZZZZZZZZZZZZZZZZZZZZZX1",
        name: "beach",
        ...({ tenant_id: OTHER } as object),
      })
      .compile();

    expect(q.parameters).toContain(T);
    expect(q.parameters).toContain(P);
    expect(q.parameters).not.toContain(OTHER);
  });

  it("rejects an INSERT whose values were replaced with another tenant's", () => {
    const build = () =>
      tenantScope
        .insertInto("api_key_projects", {
          application_id: "a",
          api_key_id: "k",
          project_id: "p",
        })
        .values({
          tenant_id: OTHER,
          application_id: "a",
          api_key_id: "k",
          project_id: "p",
        })
        .compile();

    expect(build).toThrow(ScopeError);
  });

  it("rejects an INSERT that omits the tenant column altogether", () => {
    const build = () =>
      tenantScope
        .insertInto("api_keys", {
          id: "01HZZZZZZZZZZZZZZZZZZZZZX1",
          application_id: "a",
          name: "n",
          environment: "live",
          key_hash: "0".repeat(64),
          permissions: ["asset:read"],
        })
        .columns(["id"])
        .values({ id: "01HZZZZZZZZZZZZZZZZZZZZZX1" } as never)
        .compile();

    expect(build).toThrow(/must carry the context's tenant_id/);
  });

  it("rejects an INSERT whose tenant id is an expression rather than the context's value", () => {
    const build = () =>
      tenantScope
        .insertInto("audit_logs", {
          id: "01HZZZZZZZZZZZZZZZZZZZZZX1",
          actor_type: "system",
          action: "tenant.created",
          target_type: "tenant",
        })
        .values((eb) => ({
          id: "01HZZZZZZZZZZZZZZZZZZZZZX1",
          tenant_id: eb.fn<string>("upper", [eb.val(OTHER)]),
          actor_type: "system",
          action: "tenant.created",
          target_type: "tenant",
        }))
        .compile();

    expect(build).toThrow(ScopeError);
  });

  it("accepts a multi-row INSERT when every row carries the context", () => {
    const q = projectScope
      .insertInto("tags", [
        { id: "01HZZZZZZZZZZZZZZZZZZZZZX1", name: "a" },
        { id: "01HZZZZZZZZZZZZZZZZZZZZZX2", name: "b" },
      ])
      .compile();

    expect(q.parameters.filter((v) => v === T)).toHaveLength(2);
  });

  it("refuses a project-owned table without a project in the context", () => {
    expect(() => tenantScope.selectFrom("assets").select("id").compile()).toThrow(
      /project-owned; the context has no project/,
    );
  });

  it("leaves unsafeUnscoped() builders unscoped, by design", () => {
    const q = unsafeUnscoped(db, "authenticate-credential")
      .selectFrom("api_keys")
      .select("id")
      .compile();

    expect(q.sql).toBe('select "id" from "api_keys"');
  });
});
