import { sql } from "kysely";

import { scoped, type Executor } from "@image-delivery/db";

import { toApiKey, type ApiKeyRow } from "./api-key.mapper";

import type { ApiKeyEnvironment } from "./api-key.crypto";
import type { ApiKey } from "./api-key.types";
import type { TenantContext } from "@image-delivery/tenancy";

// Every query goes through scoped(): the tenant predicate is part of the
// statement by construction (ADR-005). key_hash is written here and never
// selected -- no read path returns it (P1-02 DoD).

const COLUMNS = [
  "id",
  "application_id",
  "name",
  "environment",
  "permissions",
  "all_projects",
  "status",
  "expires_at",
  "revoked_at",
  "last_used_at",
  "created_by_user_id",
  "created_at",
  "updated_at",
] as const;

export type NewApiKey = {
  readonly id: string;
  readonly applicationId: string;
  readonly name: string;
  readonly environment: ApiKeyEnvironment;
  readonly keyHash: string;
  readonly permissions: readonly string[];
  readonly allProjects: boolean;
  readonly projectIds: readonly string[];
  readonly createdByUserId: string | null;
};

export const createApiKeyRepository = (db: Executor) => {
  const projectIdsOf = async (ctx: TenantContext, keyIds: readonly string[], tx?: Executor) => {
    if (keyIds.length === 0) return new Map<string, string[]>();
    const rows = await scoped(tx ?? db, ctx)
      .selectFrom("api_key_projects")
      .select(["api_key_id", "project_id"])
      .where("api_key_id", "in", keyIds)
      .orderBy("project_id")
      .execute();
    const byKey = new Map<string, string[]>();
    for (const row of rows)
      byKey.set(row.api_key_id, [...(byKey.get(row.api_key_id) ?? []), row.project_id]);
    return byKey;
  };

  const withProjects = async (
    ctx: TenantContext,
    rows: readonly ApiKeyRow[],
    tx?: Executor,
  ): Promise<ApiKey[]> => {
    const projects = await projectIdsOf(
      ctx,
      rows.filter((r) => !r.all_projects).map((r) => r.id),
      tx,
    );
    return rows.map((row) => toApiKey(row, projects.get(row.id) ?? []));
  };

  // ==========================================
  // READ
  // ==========================================

  const findById = async (
    ctx: TenantContext,
    applicationId: string,
    keyId: string,
    tx?: Executor,
  ): Promise<ApiKey | null> => {
    const row = await scoped(tx ?? db, ctx)
      .selectFrom("api_keys")
      .select(COLUMNS)
      .where("application_id", "=", applicationId)
      .where("id", "=", keyId)
      .executeTakeFirst();
    if (!row) return null;
    const [key] = await withProjects(ctx, [row], tx);
    return key ?? null;
  };

  const listByApplication = async (
    ctx: TenantContext,
    applicationId: string,
    tx?: Executor,
  ): Promise<ApiKey[]> => {
    const rows = await scoped(tx ?? db, ctx)
      .selectFrom("api_keys")
      .select(COLUMNS)
      .where("application_id", "=", applicationId)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .execute();
    return withProjects(ctx, rows, tx);
  };

  // ==========================================
  // WRITE
  // ==========================================

  const insert = async (ctx: TenantContext, key: NewApiKey, tx: Executor): Promise<ApiKey> => {
    const row = await scoped(tx, ctx)
      .insertInto("api_keys", {
        id: key.id,
        application_id: key.applicationId,
        name: key.name,
        environment: key.environment,
        key_hash: key.keyHash,
        permissions: [...key.permissions],
        all_projects: key.allProjects,
        created_by_user_id: key.createdByUserId,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    if (key.projectIds.length > 0) {
      await scoped(tx, ctx)
        .insertInto(
          "api_key_projects",
          key.projectIds.map((projectId) => ({
            application_id: key.applicationId,
            api_key_id: key.id,
            project_id: projectId,
          })),
        )
        .execute();
    }
    return toApiKey(row, key.projectIds);
  };

  /** Shortens (never extends) a key's life: used when it is rotated out. */
  const expireBy = async (
    ctx: TenantContext,
    keyId: string,
    expiresAt: Date,
    tx: Executor,
  ): Promise<void> => {
    await scoped(tx, ctx)
      .updateTable("api_keys")
      // least() ignores NULL: an open-ended key gets the new expiry, an
      // already-sooner expiry is kept.
      .set({ expires_at: sql<Date>`least(expires_at, ${expiresAt})` })
      .where("id", "=", keyId)
      .execute();
  };

  const revoke = async (ctx: TenantContext, keyId: string, tx?: Executor): Promise<void> => {
    await scoped(tx ?? db, ctx)
      .updateTable("api_keys")
      .set((eb) => ({ status: "revoked", revoked_at: eb.fn("now") }))
      .where("id", "=", keyId)
      .where("status", "<>", "revoked")
      .execute();
  };

  return { findById, listByApplication, insert, expireBy, revoke };
};

export type ApiKeyRepository = ReturnType<typeof createApiKeyRepository>;
