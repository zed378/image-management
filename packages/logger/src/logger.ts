import {
  destination,
  pino,
  stdSerializers,
  stdTimeFunctions,
  type DestinationStream,
  type Logger as PinoLogger,
} from "pino";

import { REDACTED, REDACT_PATHS } from "./redact";

export type Logger = PinoLogger;

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export type LoggerOptions = {
  /** `api` or `worker`; on every line as `service`. */
  readonly service: string;
  /** Build/release identifier; on every line as `version`. */
  readonly version: string;
  readonly level: LogLevel;
  /** Defaults to stdout. Tests pass an in-memory stream. */
  readonly destination?: DestinationStream;
};

/**
 * The one logger factory (docs/ENGINEERING/12). JSON to stdout, ISO
 * timestamps, the level as a label, and the redaction list applied to every
 * line. The process writes and does not rotate or ship; the platform does.
 */
export const createLogger = (options: LoggerOptions): Logger =>
  pino(
    {
      level: options.level,
      base: { service: options.service, version: options.version },
      timestamp: stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: [...REDACT_PATHS], censor: REDACTED },
      // Errors logged under `err` keep their stack and name.
      serializers: { err: stdSerializers.err },
    },
    options.destination ?? destination({ fd: 1, sync: false }),
  );

/** Identifiers bound to every line within one request or job. */
export type RequestLogContext = {
  readonly request_id: string;
  readonly trace_id: string;
  readonly span_id: string;
};

export type TenantLogContext = {
  readonly tenant_id: string;
  readonly project_id?: string;
  readonly application_id?: string;
};

/**
 * Child logger for one request or job. Services never re-add these fields
 * themselves: a service that passes `tenant_id` explicitly is a service that
 * will eventually pass the wrong one.
 */
export const requestLogger = (parent: Logger, ctx: RequestLogContext): Logger => parent.child(ctx);

/** Bind the tenancy chain once it is known (after authentication). */
export const withTenant = (logger: Logger, ctx: TenantLogContext): Logger => logger.child(ctx);
