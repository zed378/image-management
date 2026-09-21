import { usageEventSchema } from "@image-delivery/queue";
import { inProject, systemContext } from "@image-delivery/tenancy";

import { createUsageRepository } from "./usage.repository";

import type { Db } from "@image-delivery/db";
import type { JobHandler } from "@image-delivery/queue";

// The usage aggregator (P1-08, docs/DATABASE/14): one job = one batch of a
// counter for one project and day. Exactly-once: the event id is claimed in
// the ledger and the counter incremented in the same transaction, only when
// the claim succeeds -- so a redelivered job adds nothing
// (docs/ENGINEERING/08 "Idempotency", layer 3).

export type AggregateOutcome = "applied" | "duplicate";

export const createUsageAggregator = (db: Db) => {
  const usage = createUsageRepository(db);

  const apply = async (raw: unknown): Promise<AggregateOutcome> => {
    // A job is untrusted input: it may predate this deploy.
    const event = usageEventSchema.parse(raw);
    const ctx = inProject(systemContext(event.tenantId, event.requestId), event.projectId);
    return db.transaction().execute(async (tx) => {
      if (!(await usage.claimEvent(ctx, event.eventId, tx))) return "duplicate";
      await usage.addToCounter(ctx, event, tx);
      return "applied";
    });
  };

  const handler: JobHandler<unknown> = async (payload) => {
    await apply(payload);
  };

  return { apply, handler };
};
