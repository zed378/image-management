import { scoped, type Db, type Executor, type Tx } from "@image-delivery/db";
import { newId } from "@image-delivery/schema";

import type { TenantContext } from "@image-delivery/tenancy";

// The audit trail (docs/SECURITY/17, docs/DATABASE/17, P1-07).
//
// One way to change security-relevant state: `audited(db, ctx, work)`. The
// work runs in a transaction and must return the audit entries describing
// what it did; they are written in that same transaction. So the change and
// its record commit together or not at all -- a code path cannot make the
// change and skip the record, because the record is the return type.
//
// The table itself is append-only in the database (trigger + no
// UPDATE/DELETE grant for the application role), so a written entry cannot
// be edited afterwards either.

/** The closed vocabulary of audited actions. A new one is a reviewed change. */
export const AUDIT_ACTIONS = [
  "api_key.created",
  "api_key.rotated",
  "api_key.revoked",
  "api_key.suspended",
  "role.granted",
  "role.revoked",
  "asset.visibility_changed",
  "asset.purged",
  "tenant.provisioned",
  "tenant.settings_updated",
  "quota.override_set",
  "admin.access",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  readonly action: AuditAction;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly applicationId?: string | null;
  readonly projectId?: string | null;
  /** Never a secret or credential (docs/ENGINEERING/12). At most 8 KB. */
  readonly metadata?: Record<string, unknown>;
};

export type AuditedResult<T> = {
  readonly result: T;
  readonly audit: AuditEntry | readonly AuditEntry[];
};

const writeEntries = async (
  tx: Executor,
  ctx: TenantContext,
  entries: readonly AuditEntry[],
): Promise<void> => {
  if (entries.length === 0) return;
  await scoped(tx, ctx)
    .insertInto(
      "audit_logs",
      entries.map((e) => ({
        id: newId(),
        actor_type: ctx.actor.type,
        actor_id: ctx.actor.id,
        action: e.action,
        target_type: e.targetType,
        target_id: e.targetId,
        application_id: e.applicationId ?? ctx.applicationId,
        project_id: e.projectId ?? ctx.projectId,
        request_id: ctx.requestId,
        ip: ctx.sourceIp,
        metadata: JSON.stringify(e.metadata ?? {}),
      })),
    )
    .execute();
};

/**
 * Run `work` in a transaction and record its audit entries in the same
 * transaction. The only way services perform an audited change.
 */
export const audited = <T>(
  db: Db,
  ctx: TenantContext,
  work: (tx: Tx) => Promise<AuditedResult<T>>,
): Promise<T> =>
  db.transaction().execute(async (tx) => {
    const { result, audit } = await work(tx);
    const entries: readonly AuditEntry[] = Array.isArray(audit)
      ? (audit as readonly AuditEntry[])
      : [audit as AuditEntry];
    await writeEntries(tx, ctx, entries);
    return result;
  });
