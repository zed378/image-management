// The v1 error-code taxonomy (docs/API/05-ERROR-HANDLING.md).
//
// Each code maps to exactly one HTTP status and one retryability, by
// construction: AppError reads both from here, so a code cannot be thrown
// with the wrong status. A released code never changes meaning -- clients
// branch on it. Later phases add codes; they never redefine one.

export type ErrorCodeSpec = {
  readonly status: number;
  /** May a client retry the identical request and expect a different outcome? */
  readonly retryable: boolean;
  /** Safe to show a developer; overridable with a more specific message. */
  readonly message: string;
};

export const ERROR_CODES = {
  // --- 400 Bad Request -------------------------------------------------------
  validation_failed: { status: 400, retryable: false, message: "The request is invalid." },
  malformed_json: { status: 400, retryable: false, message: "The request body is not valid JSON." },
  invalid_id: { status: 400, retryable: false, message: "The id is not a valid identifier." },
  invalid_cursor: { status: 400, retryable: false, message: "The pagination cursor is invalid." },
  invalid_transform_param: { status: 400, retryable: false, message: "A transformation parameter is invalid." },
  invalid_parameter_combination: {
    status: 400,
    retryable: false,
    message: "These transformation parameters cannot be combined.",
  },
  bulk_batch_too_large: { status: 400, retryable: false, message: "The batch contains too many items." },
  url_not_allowed: { status: 400, retryable: false, message: "The URL is not allowed." },

  // --- 401 Unauthorized ------------------------------------------------------
  authentication_required: { status: 401, retryable: false, message: "Authentication is required." },
  api_key_invalid: { status: 401, retryable: false, message: "The API key is invalid." },
  session_expired: { status: 401, retryable: false, message: "The session has expired." },

  // --- 403 Forbidden ---------------------------------------------------------
  permission_denied: { status: 403, retryable: false, message: "You do not have permission to do this." },
  account_suspended: { status: 403, retryable: false, message: "The account is suspended." },
  signature_required: { status: 403, retryable: false, message: "This image requires a signed URL." },
  signature_invalid: { status: 403, retryable: false, message: "The URL signature is invalid." },
  signature_expired: { status: 403, retryable: false, message: "The signed URL has expired." },
  referrer_not_allowed: { status: 403, retryable: false, message: "This referrer is not allowed." },

  // --- 404 Not Found ---------------------------------------------------------
  // Also the answer for another tenant's resource: byte-identical to absent
  // (docs/SECURITY/11-IDOR-BOLA-PREVENTION.md).
  route_not_found: { status: 404, retryable: false, message: "No route matches this method and path." },
  application_not_found: { status: 404, retryable: false, message: "No application with that id exists." },
  project_not_found: { status: 404, retryable: false, message: "No project with that id exists." },
  asset_not_found: { status: 404, retryable: false, message: "No asset with that id exists." },
  asset_version_not_found: { status: 404, retryable: false, message: "No asset version with that id exists." },
  derivative_not_found: { status: 404, retryable: false, message: "No derivative exists for this request." },
  folder_not_found: { status: 404, retryable: false, message: "No folder with that id exists." },
  collection_not_found: { status: 404, retryable: false, message: "No collection with that id exists." },
  tag_not_found: { status: 404, retryable: false, message: "No tag with that id exists." },
  api_key_not_found: { status: 404, retryable: false, message: "No API key with that id exists." },
  webhook_not_found: { status: 404, retryable: false, message: "No webhook with that id exists." },

  // --- 409 Conflict ----------------------------------------------------------
  name_already_exists: { status: 409, retryable: false, message: "A resource with that name already exists." },
  idempotency_key_reused: {
    status: 409,
    retryable: false,
    message: "This idempotency key was already used with a different request.",
  },
  idempotency_request_in_progress: {
    status: 409,
    retryable: true,
    message: "A request with this idempotency key is still being processed.",
  },
  folder_not_empty: { status: 409, retryable: false, message: "The folder is not empty." },
  invalid_state: { status: 409, retryable: false, message: "The resource is not in a state that allows this." },

  // --- 410 Gone --------------------------------------------------------------
  asset_purged: {
    status: 410,
    retryable: false,
    message: "The asset was permanently deleted after its retention period.",
  },

  // --- 412 / 413 / 415 / 422 ---------------------------------------------------
  precondition_failed: { status: 412, retryable: false, message: "A request precondition failed." },
  payload_too_large: { status: 413, retryable: false, message: "The request body is too large." },
  upload_too_large: { status: 413, retryable: false, message: "The file exceeds the maximum upload size." },
  unsupported_media_type: { status: 415, retryable: false, message: "This file type is not supported." },
  image_decode_failed: { status: 422, retryable: false, message: "The image could not be decoded." },
  image_dimensions_exceeded: {
    status: 422,
    retryable: false,
    message: "The image exceeds the maximum supported dimensions.",
  },
  upload_incomplete: { status: 422, retryable: false, message: "The upload has not been completed." },
  url_fetch_failed: { status: 422, retryable: false, message: "The image could not be fetched from the URL." },

  // --- 429 Too Many Requests -------------------------------------------------
  // Same status, different retryability: a rate limit clears on its own, a
  // quota does not until the period resets (docs/ENGINEERING/06).
  rate_limited: { status: 429, retryable: true, message: "Too many requests; slow down." },
  quota_exceeded: { status: 429, retryable: false, message: "The plan quota for this period is exhausted." },

  // --- 5xx ---------------------------------------------------------------------
  internal_error: { status: 500, retryable: false, message: "An unexpected error occurred." },
  upstream_error: { status: 502, retryable: true, message: "An upstream service failed." },
  service_unavailable: { status: 503, retryable: true, message: "The service is temporarily unavailable." },
  storage_unavailable: { status: 503, retryable: true, message: "Storage is temporarily unavailable." },
  processing_overloaded: {
    status: 503,
    retryable: true,
    message: "Image processing is at capacity; retry shortly.",
  },
} as const satisfies Record<string, ErrorCodeSpec>;

export type ErrorCode = keyof typeof ERROR_CODES;

export const isErrorCode = (value: string): value is ErrorCode => Object.hasOwn(ERROR_CODES, value);
