import { sql } from "kysely";

import { unsafeUnscoped, type Executor } from "@image-delivery/db";

// The two queries that run before any tenant is known, and so cannot go
// through scoped(): finding a credential by its public id, and batch-writing
// when credentials were last used. Each names its reason in the type
// (docs/ENGINEERING/07 "The escape hatch"). Neither is reachable by a caller
// with a tenant id of their choosing: the lookup is by the key id the
// presented key carries, and the tenant comes *out* of the row.

export type CredentialRow = {
  readonly id: string;
  readonly tenant_id: string;
  readonly application_id: string;
  readonly environment: "live" | "test";
  readonly key_hash: string;
  readonly permissions: string[];
  readonly all_projects: boolean;
  readonly status: "active" | "suspended" | "revoked";
  readonly expires_at: Date | null;
  readonly application_status: "active" | "suspended";
  readonly tenant_status: "active" | "suspended";
  readonly project_ids: string[];
};

export const createCredentialLookup = (db: Executor) => {
  /** The key row with everything authentication decides on, or null. */
  const findForAuthentication = async (keyId: string): Promise<CredentialRow | null> => {
    const row = await unsafeUnscoped(db, "authenticate-credential")
      .selectFrom("api_keys as k")
      .innerJoin("applications as a", (j) =>
        j.onRef("a.id", "=", "k.application_id").onRef("a.tenant_id", "=", "k.tenant_id"),
      )
      .innerJoin("tenants as t", "t.id", "k.tenant_id")
      .select([
        "k.id",
        "k.tenant_id",
        "k.application_id",
        "k.environment",
        "k.key_hash",
        "k.permissions",
        "k.all_projects",
        "k.status",
        "k.expires_at",
        "a.status as application_status",
        "t.status as tenant_status",
      ])
      .select((eb) =>
        eb.fn
          .coalesce(
            eb
              .selectFrom("api_key_projects as p")
              .select(sql<string[]>`array_agg(p.project_id::text order by p.project_id)`.as("ids"))
              .whereRef("p.api_key_id", "=", "k.id")
              .whereRef("p.tenant_id", "=", "k.tenant_id"),
            sql<string[]>`'{}'::text[]`,
          )
          .as("project_ids"),
      )
      .where("k.id", "=", keyId)
      .where("a.deleted_at", "is", null)
      .where("t.deleted_at", "is", null)
      .executeTakeFirst();
    return row ?? null;
  };

  /** One statement for every key seen since the last flush. */
  const recordUse = async (keyIds: readonly string[], at: Date): Promise<void> => {
    if (keyIds.length === 0) return;
    await unsafeUnscoped(db, "record-credential-use")
      .updateTable("api_keys")
      .set({ last_used_at: at })
      .where("id", "in", keyIds)
      .where((eb) => eb.or([eb("last_used_at", "is", null), eb("last_used_at", "<", at)]))
      .execute();
  };

  return { findForAuthentication, recordUse };
};

export type CredentialLookup = ReturnType<typeof createCredentialLookup>;
