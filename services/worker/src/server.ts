// Entry point for the worker deployable (ADR-017).
//
//   node dist/server.js                 run queue consumers
//   node dist/server.js --check-config  validate configuration and exit
//
// Configuration is validated before anything else starts
// (docs/DEVOPS/03-CONFIGURATION.md). Consumers are registered as their tasks
// land: usage (P1-08); derivatives (P3-09) and webhooks (P6-04) to come.

import { ConfigError, withDotEnv } from "@image-delivery/config";
import { createDb } from "@image-delivery/db";
import { createLogger } from "@image-delivery/logger";
import { createBullWorker, USAGE_QUEUE } from "@image-delivery/queue";

import { loadWorkerConfig, type WorkerConfig } from "./config";
import { createUsageAggregator } from "./modules/usage/usage.aggregator";

const loadConfigOrExit = (): WorkerConfig => {
  try {
    return loadWorkerConfig(withDotEnv(process.env));
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`worker: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
};

const config = loadConfigOrExit();

if (process.argv.includes("--check-config")) {
  process.stderr.write(`worker: configuration valid (${config.process.nodeEnv})\n`);
  process.exit(0);
}

const logger = createLogger({
  service: "worker",
  version: config.process.serviceVersion,
  level: config.process.logLevel,
});
const db = createDb({
  ...config.database,
  applicationName: "worker",
  onPoolError: (err) => {
    logger.warn({ err }, "idle database connection lost");
  },
});

const workers = [
  createBullWorker(USAGE_QUEUE, config.redis.url, createUsageAggregator(db).handler, {
    concurrency: config.concurrency.usage,
    onFailed: (err, jobId) => {
      logger.error({ err, job_id: jobId, queue: USAGE_QUEUE }, "job failed");
    },
  }),
];
logger.info({ queues: [USAGE_QUEUE] }, "worker started");

// Graceful shutdown (docs/ENGINEERING/08 "Worker rules"): stop taking jobs,
// let in-flight ones finish, then release connections. A second signal
// forces exit.
let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) process.exit(1);
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  try {
    await Promise.all(workers.map((w) => w.close()));
    await db.destroy();
    logger.info("shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "shutdown failed");
    process.exit(1);
  }
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
