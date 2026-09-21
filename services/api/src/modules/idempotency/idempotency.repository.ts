import { scoped, type Executor } from "@image-delivery/db";

import type { TenantContext } from "@image-delivery/tenancy";

// Rows of idempotency_keys (docs/API/08). Scoped to the context's project.

export type IdempotencyRecord = {
  readonly requestHash: string;
  readonly status: "in_progress" | "completed";
  readonly responseStatus: number | null;
  readonly responseBody: unknown;
  readonly expiresAt: Date;
};

export const createIdempotencyRepository = (db: Executor) => {
  /** Claim the key; false when a live row already holds it. */
  const claim = async (
    ctx: TenantContext,
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<boolean> => {
    // An expired claim is released first, so an old key can be reused.
    await scoped(db, ctx)
      .deleteFrom("idempotency_keys")
      .where("key", "=", key)
      .where("expires_at", "<=", new Date())
      .execute();
    const row = await scoped(db, ctx)
      .insertInto("idempotency_keys", {
        key,
        request_hash: requestHash,
        expires_at: new Date(Date.now() + ttlSeconds * 1000),
      })
      .onConflict((oc) => oc.columns(["tenant_id", "project_id", "key"]).doNothing())
      .returning("key")
      .executeTakeFirst();
    return row !== undefined;
  };

  const find = async (ctx: TenantContext, key: string): Promise<IdempotencyRecord | null> => {
    const row = await scoped(db, ctx)
      .selectFrom("idempotency_keys")
      .select(["request_hash", "status", "response_status", "response_body", "expires_at"])
      .where("key", "=", key)
      .executeTakeFirst();
    return row
      ? {
          requestHash: row.request_hash,
          status: row.status,
          responseStatus: row.response_status,
          responseBody: row.response_body,
          expiresAt: new Date(row.expires_at),
        }
      : null;
  };

  const complete = async (
    ctx: TenantContext,
    key: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> => {
    await scoped(db, ctx)
      .updateTable("idempotency_keys")
      .set({
        status: "completed",
        response_status: responseStatus,
        response_body: JSON.stringify(responseBody),
      })
      .where("key", "=", key)
      .execute();
  };

  const release = async (ctx: TenantContext, key: string): Promise<void> => {
    await scoped(db, ctx).deleteFrom("idempotency_keys").where("key", "=", key).execute();
  };

  return { claim, find, complete, release };
};
