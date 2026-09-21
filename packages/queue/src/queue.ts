import { Queue, Worker, type ConnectionOptions, type JobsOptions } from "bullmq";

// The job queue (ADR-007, docs/ENGINEERING/08 Part 2). One small interface,
// two implementations: BullMQ on Redis for the deployables, and an
// in-memory one for unit tests that need to see what was enqueued.

export type EnqueueOptions = {
  /** The natural key: the queue drops a job whose id it already holds (idempotency layer 1). */
  readonly jobId: string;
};

export type JobQueue<P> = {
  readonly add: (jobName: string, payload: P, options: EnqueueOptions) => Promise<void>;
  readonly close: () => Promise<void>;
};

export type JobHandler<P> = (
  payload: P,
  meta: { readonly jobId: string; readonly attempt: number },
) => Promise<void>;

export type JobWorker = { readonly close: () => Promise<void> };

/** Explicit per job type (docs/ENGINEERING/08 "Retry and failure"), never a library default. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 3_600 },
  removeOnFail: false,
};

const connectionFor = (redisUrl: string): ConnectionOptions => {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    // BullMQ's own requirement for blocking connections.
    maxRetriesPerRequest: null,
  };
};

export const createBullQueue = <P>(
  name: string,
  redisUrl: string,
  jobOptions: JobsOptions = DEFAULT_JOB_OPTIONS,
): JobQueue<P> => {
  const queue = new Queue(name, { connection: connectionFor(redisUrl) });
  return {
    add: async (jobName, payload, options) => {
      await queue.add(jobName, payload, { ...jobOptions, jobId: options.jobId });
    },
    close: () => queue.close(),
  };
};

export const createBullWorker = <P>(
  name: string,
  redisUrl: string,
  handler: JobHandler<P>,
  options: {
    readonly concurrency: number;
    readonly onFailed?: (err: Error, jobId: string) => void;
  },
): JobWorker => {
  const worker = new Worker(
    name,
    async (job) => {
      await handler(job.data as P, { jobId: job.id ?? "", attempt: job.attemptsMade + 1 });
    },
    { connection: connectionFor(redisUrl), concurrency: options.concurrency },
  );
  worker.on("failed", (job, err) => {
    options.onFailed?.(err, job?.id ?? "");
  });
  return { close: () => worker.close() };
};

/** For unit tests: records every enqueued job; `run` feeds them to a handler. */
export const createMemoryQueue = <P>() => {
  const jobs = new Map<string, { name: string; payload: P }>();
  const queue: JobQueue<P> = {
    add: (jobName, payload, options) => {
      if (!jobs.has(options.jobId)) jobs.set(options.jobId, { name: jobName, payload });
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
  return {
    queue,
    jobs: () => [...jobs.values()],
    run: async (handler: JobHandler<P>) => {
      for (const [jobId, job] of jobs) await handler(job.payload, { jobId, attempt: 1 });
      jobs.clear();
    },
  };
};
