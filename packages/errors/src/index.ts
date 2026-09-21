// Response envelopes, the AppError type and the v1 error-code taxonomy.
// docs/API/01-API-STANDARDS.md, docs/API/05-ERROR-HANDLING.md,
// docs/ENGINEERING/06-ERROR-RESPONSE-STANDARDS.md.

export { AppError, isAppError, type AppErrorOptions } from "./app-error";
export { ERROR_CODES, isErrorCode, type ErrorCode, type ErrorCodeSpec } from "./codes";
export {
  errorEnvelope,
  successEnvelope,
  type ErrorDetail,
  type ErrorEnvelope,
  type ResponseMeta,
  type SuccessEnvelope,
} from "./envelope";
