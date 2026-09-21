import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  createBullQueue,
  createBullWorker,
  RECORD_USAGE_JOB,
  type JobQueue,
  type JobWorker,
  type UsageEvent,
} from "@image-delivery/queue";
import { newId } from "@image-delivery/schema";
import {
  createTestDatabase,
  seedTenant,
  type SeededTenant,
  type TestDatabase,
} from "@image-delivery/test-utils";

import { createUsageAggregator } from "../src/modules/usage/usage.aggregator";

// P1-08: the metering substrate, end to end on real Redis and PostgreSQL --
// an event enqueued through BullMQ lands in `usage`, exactly once, however
// often it is delivered.

let t: TestDatabase;
let s: SeededTenant;
let aggregator: ReturnType<typeof createUsageAggregator>;

const event = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  eventId: newId(),
  tenantId: s.tenantId,
  applicationId: s.applicationId,
  projectId: s.projectId,
  metric: "requests",
  amount: 3,
  day: "2026-09-21",
  requestId: null,
  ...overrides,
});

const counter = async (metric: string, day = "2026-09-21") =>
  (
    await t.db
      .selectFrom("usage")
      .select("value")
      .where("project_id", "=", s.projectId)
      .where("metric", "=", metric as "requests")
      .where("day", "=", day)
      .executeTakeFirst()
  )?.value ?? 0;

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
  s = await seedTenant(t.db);
  aggregator = createUsageAggregator(t.db);
});
afterAll(async () => {
  await t.destroy();
});

describe("usage aggregation", () => {
  it("adds batches of the same bucket together", async () => {
    await aggregator.apply(event({ metric: "transformations", amount: 2 }));
    await aggregator.apply(event({ metric: "transformations", amount: 5 }));

    expect(await counter("transformations")).toBe(7);
  });

  it("applies a redelivered event once", async () => {
    const once = event({ metric: "bandwidth_bytes", amount: 1_000 });

    expect(await aggregator.apply(once)).toBe("applied");
    expect(await aggregator.apply(once)).toBe("duplicate");
    expect(await aggregator.apply(once)).toBe("duplicate");

    expect(await counter("bandwidth_bytes")).toBe(1_000);
  });

  it("applies concurrent deliveries of one event once", async () => {
    const racing = event({ metric: "requests", amount: 11, day: "2026-09-20" });

    const outcomes = await Promise.all([1, 2, 3, 4].map(() => aggregator.apply(racing)));

    expect(outcomes.filter((o) => o === "applied")).toHaveLength(1);
    expect(await counter("requests", "2026-09-20")).toBe(11);
  });

  it("rejects a malformed or gauge event without writing", async () => {
    await expect(aggregator.apply({ ...event(), metric: "storage_bytes" })).rejects.toThrow();
    await expect(aggregator.apply({ ...event(), amount: -1 })).rejects.toThrow();
    await expect(aggregator.apply({ ...event(), extra: true })).rejects.toThrow();
  });

  it("refuses an event whose project is not in its tenant", async () => {
    const other = await seedTenant(t.db);

    await expect(aggregator.apply(event({ projectId: other.projectId }))).rejects.toThrow(
      /usage_project_fk/,
    );
  });
});

describe("through BullMQ", () => {
  let queue: JobQueue<UsageEvent>;
  let worker: JobWorker;
  const queueName = `usage-metering-test-${newId()}`;

  beforeAll(() => {
    queue = createBullQueue<UsageEvent>(queueName, inject("redisUrl"));
    worker = createBullWorker(queueName, inject("redisUrl"), aggregator.handler, {
      concurrency: 2,
    });
  });
  afterAll(async () => {
    await worker.close();
    await queue.close();
  });

  it("consumes an enqueued event into the usage table", async () => {
    const e = event({ metric: "requests", amount: 42, day: "2026-09-19" });

    await queue.add(RECORD_USAGE_JOB, e, { jobId: e.eventId });

    await expect.poll(() => counter("requests", "2026-09-19"), { timeout: 15_000 }).toBe(42);
  });
});
