// Entry point for the worker deployable (ADR-017). Configuration is
// validated before anything else starts (docs/DEVOPS/03-CONFIGURATION.md).

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
process.stderr.write(`worker: configuration valid (${config.process.nodeEnv})\n`);
