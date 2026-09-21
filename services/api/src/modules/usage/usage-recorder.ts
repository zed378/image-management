import {
  RECORD_USAGE_JOB,
  type CounterMetric,
  type JobQueue,
  type UsageEvent,
} from "@image-delivery/queue";
import { newId } from "@image-delivery/schema";

// Metering without a write on the request path (docs/DATABASE/14, P1-08):
// a request adds to an in-memory counter keyed by (project, metric, UTC day);
// a timer turns each counter into one queue job. Thousands of requests
// become one job per project and metric per minute. The aggregator applies
// each job exactly once (usage_event_ledger); losing a process loses at most
// one interval of counts, which the maintenance recompute can reconcile.

export const USAGE_FLUSH_INTERVAL_MS = 60_000;

export type UsageScope = {
  readonly tenantId: string;
  readonly applicationId: string;
  readonly projectId: string;
};

export type UsageRecorder = {
  readonly record: (scope: UsageScope, metric: CounterMetric, amount: number) => void;
  readonly flush: () => Promise<void>;
  readonly start: () => void;
  readonly stop: () => Promise<void>;
};

type Bucket = UsageScope & { metric: CounterMetric; day: string; amount: number };

export const createUsageRecorder = (
  queue: JobQueue<UsageEvent>,
  options: {
    readonly intervalMs?: number;
    readonly now?: () => Date;
    readonly onError?: (err: unknown) => void;
  } = {},
): UsageRecorder => {
  const now = options.now ?? (() => new Date());
  let buckets = new Map<string, Bucket>();
  let timer: NodeJS.Timeout | null = null;

  const flush = async (): Promise<void> => {
    if (buckets.size === 0) return;
    const batch = [...buckets.values()];
    buckets = new Map();
    for (const bucket of batch) {
      const event: UsageEvent = {
        eventId: newId(),
        tenantId: bucket.tenantId,
        applicationId: bucket.applicationId,
        projectId: bucket.projectId,
        metric: bucket.metric,
        amount: bucket.amount,
        day: bucket.day,
        requestId: null,
      };
      try {
        await queue.add(RECORD_USAGE_JOB, event, { jobId: event.eventId });
      } catch (err) {
        // Keep the counts for the next flush rather than drop them.
        const key = `${bucket.projectId}|${bucket.metric}|${bucket.day}`;
        const pending = buckets.get(key);
        buckets.set(key, pending ? { ...pending, amount: pending.amount + bucket.amount } : bucket);
        options.onError?.(err);
      }
    }
  };

  return {
    record: (scope, metric, amount) => {
      if (!Number.isInteger(amount) || amount <= 0) return;
      const day = now().toISOString().slice(0, 10);
      const key = `${scope.projectId}|${metric}|${day}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.amount += amount;
      else buckets.set(key, { ...scope, metric, day, amount });
    },
    flush,
    start: () => {
      if (timer) return;
      timer = setInterval(() => void flush(), options.intervalMs ?? USAGE_FLUSH_INTERVAL_MS);
      timer.unref();
    },
    stop: async () => {
      if (timer) clearInterval(timer);
      timer = null;
      await flush();
    },
  };
};
