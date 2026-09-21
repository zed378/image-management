import { describe, expect, it } from "vitest";

import { createMemoryQueue, usageEventSchema, type UsageEvent } from "@image-delivery/queue";

import { createUsageRecorder } from "./usage-recorder";

const scope = {
  tenantId: "01HZZZZZZZZZZZZZZZZZZZZZT1",
  applicationId: "01HZZZZZZZZZZZZZZZZZZZZZA1",
  projectId: "01HZZZZZZZZZZZZZZZZZZZZZP1",
};

describe("usage recorder", () => {
  it("sums per project, metric and UTC day, and enqueues one valid job per bucket", async () => {
    const memory = createMemoryQueue<UsageEvent>();
    let now = new Date("2026-09-21T23:59:59Z");
    const recorder = createUsageRecorder(memory.queue, { now: () => now });

    recorder.record(scope, "requests", 1);
    recorder.record(scope, "requests", 1);
    recorder.record(scope, "bandwidth_bytes", 5_000);
    now = new Date("2026-09-22T00:00:01Z");
    recorder.record(scope, "requests", 1);
    await recorder.flush();

    const events = memory.jobs().map((j) => usageEventSchema.parse(j.payload));
    expect(events.map((e) => [e.metric, e.day, e.amount]).sort()).toEqual(
      [
        ["bandwidth_bytes", "2026-09-21", 5_000],
        ["requests", "2026-09-21", 2],
        ["requests", "2026-09-22", 1],
      ].sort(),
    );
    expect(new Set(events.map((e) => e.eventId)).size).toBe(3);
  });

  it("ignores non-positive or fractional amounts", async () => {
    const memory = createMemoryQueue<UsageEvent>();
    const recorder = createUsageRecorder(memory.queue);

    recorder.record(scope, "requests", 0);
    recorder.record(scope, "requests", -3);
    recorder.record(scope, "requests", 1.5);
    await recorder.flush();

    expect(memory.jobs()).toEqual([]);
  });

  it("keeps the counts for the next flush when enqueueing fails", async () => {
    const memory = createMemoryQueue<UsageEvent>();
    let failing = true;
    const errors: unknown[] = [];
    const recorder = createUsageRecorder(
      {
        add: (name, payload, opts) =>
          failing ? Promise.reject(new Error("redis down")) : memory.queue.add(name, payload, opts),
        close: () => Promise.resolve(),
      },
      { onError: (err) => errors.push(err) },
    );

    recorder.record(scope, "transformations", 4);
    await recorder.flush();
    failing = false;
    recorder.record(scope, "transformations", 1);
    await recorder.stop();

    expect(errors).toHaveLength(1);
    expect(memory.jobs().map((j) => j.payload.amount)).toEqual([5]);
  });
});
