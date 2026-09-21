// Entry point for the api deployable (ADR-017).
//
//   node dist/server.js                 serve
//   node dist/server.js --check-config  validate configuration and exit
//
// Configuration is validated before anything else: a process with invalid
// configuration refuses to start rather than failing on its first request
// (docs/DEVOPS/03-CONFIGURATION.md).

import { createRedisClient } from "@image-delivery/cache";
import { ConfigError, withDotEnv } from "@image-delivery/config";
import { createDb } from "@image-delivery/db";
import { createLogger } from "@image-delivery/logger";
import { createStorageAdapter } from "@image-delivery/storage-adapter";

import { buildApp } from "./app";
import { loadApiConfig, type ApiConfig } from "./config";
import { createCredentialLookup } from "./modules/api-keys/api-key.authentication";
import { createApiKeyService } from "./modules/api-keys/api-key.service";
import { createLastUsedTracker } from "./modules/api-keys/last-used-tracker";
import { readinessChecks } from "./readiness";

const loadConfigOrExit = (): ApiConfig => {
  try {
    return loadApiConfig(withDotEnv(process.env));
  } catch (err) {
    if (err instanceof ConfigError) {
      // The logger is configured from this very config, so a config failure
      // is reported on stderr directly. ConfigError never contains values.
      process.stderr.write(`api: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
};

const config = loadConfigOrExit();

if (process.argv.includes("--check-config")) {
  process.stderr.write(`api: configuration valid (${config.process.nodeEnv})\n`);
  process.exit(0);
}

const logger = createLogger({
  service: "api",
  version: config.process.serviceVersion,
  level: config.process.logLevel,
});
const db = createDb({
  ...config.database,
  applicationName: "api",
  onPoolError: (err) => {
    logger.warn({ err }, "idle database connection lost");
  },
});
const redis = createRedisClient(config.redis.url, "api", (err) => {
  logger.warn({ err }, "redis connection error");
});
const storage = await createStorageAdapter(config.storage);

const lastUsed = createLastUsedTracker(createCredentialLookup(db).recordUse, {
  onError: (err) => {
    logger.warn({ err }, "recording API key use failed; will retry");
  },
});
lastUsed.start();
const apiKeys = createApiKeyService({ db, pepper: config.credentials.apiKeyPepper, lastUsed });

const app = await buildApp({
  logger,
  readinessChecks: readinessChecks({ db, redis, storage }),
  apiKeys,
});

// Graceful shutdown: stop accepting, let in-flight requests finish, then
// release connections. A second signal forces exit.
let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) process.exit(1);
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  try {
    await app.close();
    await lastUsed.stop();
    await Promise.allSettled([db.destroy(), redis.quit(), storage.close()]);
    logger.info("shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "shutdown failed");
    process.exit(1);
  }
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await redis.connect();
} catch (err) {
  // Not fatal: /readyz reports Redis as failing until it is reachable, and
  // ioredis keeps reconnecting in the background.
  logger.warn({ err }, "redis not reachable at startup");
}

await app.listen({ host: config.http.host, port: config.http.port });
logger.info({ host: config.http.host, port: config.http.port }, "api listening");
