import { ERROR_CODES, type ErrorCode } from "./codes";

import type { ErrorDetail } from "./envelope";

export type AppErrorOptions = {
  /** A more specific, developer-safe message. Never include secrets or input values. */
  readonly message?: string;
  readonly details?: readonly ErrorDetail[];
  /** The underlying cause, for logs only; never serialized to a client. */
  readonly cause?: unknown;
};

/**
 * The one error type application code throws (docs/ENGINEERING/06).
 * Status and retryability come from the code's registry entry, so a code can
 * never be sent with the wrong status.
 *
 * 5xx errors never expose their message to a client, whatever was passed:
 * their message may carry internals, and the cause belongs in the log.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details: readonly ErrorDetail[];
  /** May `message` be sent to the client? */
  readonly expose: boolean;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const spec = ERROR_CODES[code];
    super(
      options.message ?? spec.message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "AppError";
    this.code = code;
    this.status = spec.status;
    this.retryable = spec.retryable;
    this.details = options.details ?? [];
    this.expose = spec.status < 500;
  }

  /** The message a client may see: this error's own for 4xx, the generic one for 5xx. */
  get publicMessage(): string {
    return this.expose ? this.message : ERROR_CODES[this.code].message;
  }
}

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;
