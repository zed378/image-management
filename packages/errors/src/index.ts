// Response envelopes and (P0-09) the AppError hierarchy and error-code
// registry. docs/API/01-API-STANDARDS.md, docs/API/05-ERROR-HANDLING.md.

export {
  errorEnvelope,
  successEnvelope,
  type ErrorDetail,
  type ErrorEnvelope,
  type ResponseMeta,
  type SuccessEnvelope,
} from "./envelope";
