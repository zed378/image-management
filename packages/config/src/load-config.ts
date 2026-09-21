import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { ConfigError, type ConfigIssue } from "./config-error";

import type { z } from "zod";

export type RawEnv = Readonly<Record<string, string | undefined>>;

/**
 * Drop empty strings: `KEY=` in a .env file means "unset", and treating it as
 * a present-but-empty value would let a required secret slip through as "".
 */
const withoutEmpty = (env: RawEnv): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
};

const describeIssue = (issue: z.core.$ZodIssue, env: Record<string, string>): ConfigIssue => {
  const variable = String(issue.path[0] ?? "(configuration)");
  // Cross-field rules carry a more specific reason than "missing" (e.g.
  // "is required when STORAGE_PROVIDER=s3"), so they are checked first.
  if (issue.code === "custom") {
    return { variable, reason: issue.message };
  }
  if (issue.path.length > 0 && env[variable] === undefined) {
    return { variable, reason: "is required but not set" };
  }
  if (issue.code === "invalid_value" && "values" in issue) {
    return {
      variable,
      reason: `must be one of: ${issue.values.map((v) => String(v)).join(", ")}`,
    };
  }
  // Zod's own message for type/format/range failures describes the
  // constraint, not the received value, so it is safe to surface.
  return { variable, reason: `is invalid: ${issue.message}` };
};

/**
 * Validate `env` against `schema` and return the typed result, or throw a
 * ConfigError naming every problem at once. Fail fast, fail completely: a
 * developer fixing configuration should see all missing variables in one run.
 */
export const parseConfig = <TSchema extends z.ZodType>(
  schema: TSchema,
  env: RawEnv,
): z.output<TSchema> => {
  const cleaned = withoutEmpty(env);
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => describeIssue(issue, cleaned)));
  }
  return result.data;
};

/**
 * Merge a local `.env` file under the real process environment.
 *
 * Precedence (docs/DEVOPS/03-CONFIGURATION.md): process environment wins,
 * then `.env`, then schema defaults. A `.env` file is read only outside
 * production -- in production every value comes from the environment the
 * orchestrator injects, and a stray file baked into an image is ignored.
 */
export const withDotEnv = (env: RawEnv, dotEnvPath = ".env"): RawEnv => {
  if (env["NODE_ENV"] === "production" || !existsSync(dotEnvPath)) return env;
  const fromFile = parseEnv(readFileSync(dotEnvPath, "utf8"));
  return { ...fromFile, ...env };
};
