import { z } from "zod";

import { ULID_PATTERN } from "@image-delivery/schema";

// The usage-metering job contract, shared by its producers (api, and later
// the worker itself for transformation counts) and its consumer (the
// worker's aggregator). docs/DATABASE/14, docs/PLAN/15, P1-08.

export const USAGE_QUEUE = "usage-metering" as const;
export const RECORD_USAGE_JOB = "record-usage" as const;

/**
 * Metered by events. The gauges (storage_bytes, assets) are not events:
 * they are recomputed from source tables by the maintenance job.
 */
export const COUNTER_METRICS = ["requests", "bandwidth_bytes", "transformations"] as const;
export type CounterMetric = (typeof COUNTER_METRICS)[number];

const ulid = z.string().regex(ULID_PATTERN);

/**
 * One batch of usage: `amount` units of `metric` for one project on one UTC
 * day. `eventId` is unique per batch -- it is the job id (queue dedupe) and
 * the ledger key (exactly-once application), so a redelivered job is never
 * counted twice.
 */
export const usageEventSchema = z
  .object({
    eventId: ulid,
    tenantId: ulid,
    applicationId: ulid,
    projectId: ulid,
    metric: z.enum(COUNTER_METRICS),
    amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    day: z.iso.date(),
    requestId: ulid.nullable(),
  })
  .strict();

export type UsageEvent = z.infer<typeof usageEventSchema>;
