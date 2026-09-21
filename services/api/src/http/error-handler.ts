import { ZodError } from "zod";

import { AppError, errorEnvelope, type ErrorDetail } from "@image-delivery/errors";

import type { FastifyError, FastifyInstance } from "fastify";

// The only place that maps an error to a status code and a body
// (docs/API/05-ERROR-HANDLING.md, docs/ENGINEERING/06). Rules:
//
//  * AppError      -> its registry status; its message if 4xx, generic if 5xx
//  * validation    -> 400 validation_failed, details = { field, reason } only
//  * framework     -> mapped to the matching registered code
//  * anything else -> 500 internal_error with the generic message
//
// Never echoed to a client: a received value, an internal message, a stack.
// The cause goes to the log, joined by request_id.

type AjvIssue = {
  readonly instancePath?: string;
  readonly keyword?: string;
  readonly params?: Record<string, unknown>;
};

const ajvDetails = (issues: readonly AjvIssue[]): ErrorDetail[] =>
  issues.map((issue) => {
    const missing = issue.params?.["missingProperty"];
    const additional = issue.params?.["additionalProperty"];
    const path = (issue.instancePath ?? "").replace(/^\//, "").replaceAll("/", ".");
    const field = [
      path,
      typeof missing === "string" ? missing : typeof additional === "string" ? additional : "",
    ]
      .filter(Boolean)
      .join(".");
    return field
      ? { field, reason: issue.keyword ?? "invalid" }
      : { reason: issue.keyword ?? "invalid" };
  });

const zodDetails = (err: ZodError): ErrorDetail[] =>
  err.issues.map((issue) => {
    const field = issue.path.map(String).join(".");
    // issue.code is Zod's closed vocabulary (too_big, invalid_type, ...);
    // issue.message is deliberately not used, since it can describe input.
    return field ? { field, reason: issue.code } : { reason: issue.code };
  });

/** Framework error codes, mapped to registered codes. */
const FASTIFY_CODES: Readonly<Record<string, ConstructorParameters<typeof AppError>[0]>> = {
  FST_ERR_CTP_BODY_TOO_LARGE: "payload_too_large",
  FST_ERR_CTP_INVALID_MEDIA_TYPE: "unsupported_media_type",
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: "validation_failed",
  FST_ERR_CTP_EMPTY_JSON_BODY: "malformed_json",
  FST_ERR_CTP_INVALID_JSON_BODY: "malformed_json",
  // @fastify/multipart (P2-02)
  FST_REQ_FILE_TOO_LARGE: "upload_too_large",
  FST_FILES_LIMIT: "validation_failed",
  FST_FIELDS_LIMIT: "validation_failed",
  FST_PARTS_LIMIT: "validation_failed",
  FST_PROTO_VIOLATION: "validation_failed",
  FST_INVALID_MULTIPART_CONTENT_TYPE: "unsupported_media_type",
};

export const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError)
    return new AppError("validation_failed", { details: zodDetails(err) });

  const fastifyError = err as Partial<FastifyError> | null;
  if (fastifyError?.validation) {
    return new AppError("validation_failed", { details: ajvDetails(fastifyError.validation) });
  }
  const mapped = fastifyError?.code ? FASTIFY_CODES[fastifyError.code] : undefined;
  if (mapped) return new AppError(mapped, { cause: err });
  // Fastify's JSON parser reports a syntax error as a 400 SyntaxError.
  if (err instanceof SyntaxError && fastifyError?.statusCode === 400) {
    return new AppError("malformed_json", { cause: err });
  }
  return new AppError("internal_error", { cause: err });
};

export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((err, request, reply) => {
    const appError = toAppError(err);
    if (appError.status >= 500) {
      request.log.error({ err: appError.cause ?? appError, code: appError.code }, "request failed");
    } else {
      request.log.warn({ code: appError.code }, "request rejected");
    }
    if (appError.retryable && appError.status === 503) reply.header("retry-after", "5");
    return reply
      .status(appError.status)
      .send(errorEnvelope(appError.code, appError.publicMessage, request.id, appError.details));
  });
};
