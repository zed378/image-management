// Entry point for the worker deployable (ADR-017).
//
//   node dist/server.js                 run queue consumers
//   node dist/server.js --check-config  validate configuration and exit
//
// Configuration is validated before anything else starts
// (docs/DEVOPS/03-CONFIGURATION.md). Consumers are registered as their tasks
// land (P1-08 usage, P3-09 derivatives, P6-04 webhooks).

import { ConfigError, withDotEnv } from "@image-delivery/config";

import { loadWorkerConfig, type WorkerConfig } from "./config";

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

process.stderr.write(`worker: configuration valid (${config.process.nodeEnv}); no consumers registered yet\n`);
