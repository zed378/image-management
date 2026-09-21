export type ConfigIssue = {
  /** The environment variable name, e.g. `DATABASE_URL`. */
  readonly variable: string;
  /** Why it was rejected. Never contains the value, which may be a secret. */
  readonly reason: string;
};

/**
 * Thrown when configuration is missing or invalid. The message lists the
 * offending variable names and reasons only -- never their values -- so it is
 * safe to print at startup and to ship to a log aggregator.
 */
export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(
      `invalid configuration (${issues.length} problem${issues.length === 1 ? "" : "s"}):\n` +
        issues.map((i) => `  - ${i.variable}: ${i.reason}`).join("\n"),
    );
    this.name = "ConfigError";
    this.issues = issues;
  }
}
