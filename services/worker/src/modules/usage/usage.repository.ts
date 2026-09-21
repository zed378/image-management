import { sql } from "kysely";

import { scoped, type Executor } from "@image-delivery/db";

import type { UsageEvent } from "@image-delivery/queue";
import type { TenantContext } from "@image-delivery/tenancy";

// Writes to `usage` and its ledger (docs/DATABASE/14). Both through scoped():
// the worker is not exempt from ADR-005 (docs/ENGINEERING/08 "Worker rules").

export const createUsageRepository = (db: Executor) => {
  /** Claim the event id; false when it was already applied (a redelivery). */
  const claimEvent = async (
    ctx: TenantContext,
    eventId: string,
    tx?: Executor,
  ): Promise<boolean> => {
    const row = await scoped(tx ?? db, ctx)
      .insertInto("usage_event_ledger", { event_id: eventId })
      .onConflict((oc) => oc.column("event_id").doNothing())
      .returning("event_id")
      .executeTakeFirst();
    return row !== undefined;
  };

  /** Add `amount` to the day's counter, creating the bucket on first use. */
  const addToCounter = async (
    ctx: TenantContext,
    event: UsageEvent,
    tx?: Executor,
  ): Promise<void> => {
    await scoped(tx ?? db, ctx)
      .insertInto("usage", {
        application_id: event.applicationId,
        metric: event.metric,
        day: event.day,
        value: event.amount,
      })
      .onConflict((oc) =>
        oc
          .columns(["project_id", "metric", "day"])
          .doUpdateSet({ value: sql<number>`usage.value + excluded.value` }),
      )
      .execute();
  };

  return { claimEvent, addToCounter };
};
