// Entry point for the api deployable (ADR-017). Loads and validates
// configuration first: a process with invalid configuration refuses to start
// rather than failing on its first request (docs/DEVOPS/03-CONFIGURATION.md).

import { ConfigError, withDotEnv } from "@image-delivery/config";

import { loadApiConfig, type ApiConfig } from "./config";

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
process.stderr.write(`api: configuration valid (${config.process.nodeEnv})\n`);
