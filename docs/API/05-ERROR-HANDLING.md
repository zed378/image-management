# 05 - Error Handling

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How every failure reaches a client: the envelope, the complete v1 error-code
taxonomy, and the rules that keep errors from leaking internals. Normative;
`docs/ENGINEERING/06` describes the code that implements it.

## Category Mandate

The platform is API-first. These documents are the source of truth for
request/response shapes, status codes, and error formats -- SDKs and the
dashboard are clients of this contract.

---

## The envelope

```json
{
  "error": {
    "code": "invalid_transform_param",
    "message": "Parameter 'w' must be between 1 and 8192.",
    "details": [{ "field": "w", "reason": "out_of_range" }],
    "request_id": "01M31RYZDTGHDB78WVH9AQW2GD"
  }
}
```

| Field | Contract |
|---|---|
| `code` | Stable, machine-readable, from the table below. **Clients branch on this.** |
| `message` | Human-readable, safe to show a developer. May be reworded at any time; never parse it. |
| `details` | Always present, possibly empty. Each item is `{ "field"?: string, "reason": string }`. |
| `request_id` | Equals the `X-Request-Id` header. Quote it in support requests. |

An error response never contains `data`, and is always JSON whatever the
request's `Accept` header.

## Rules

1. **One code, one status, one retryability.** Enforced by construction:
   `AppError` reads status and retryability from the registry
   (`packages/errors/src/codes.ts`), so a code cannot be sent with any other.
2. **A released code never changes meaning.** Later phases add codes; they
   never redefine or reuse one. Removing or repurposing a code is a breaking
   change (`04-API-VERSIONING.md`).
3. **5xx messages are generic.** Whatever the thrower passed, a 5xx carries
   the registry's default message; the real cause is logged at `error`,
   joined by `request_id`.
4. **Nothing is echoed.** A validation `detail` names the field and a reason
   from a closed vocabulary; it never repeats the received value, which may
   be attacker-supplied or a secret placed in the wrong field.
5. **Another tenant's resource is `404`**, byte-identical to an absent one --
   same code, same message, same `details` (`docs/SECURITY/11`).
6. **`401` versus `403`:** `401` means no or invalid credential; `403` means a
   valid credential that may not do this (`P1-03`).
7. **`retryable`** tells SDKs whether retrying the identical request can
   succeed. `429 rate_limited` is retryable (honour `Retry-After`);
   `429 quota_exceeded` is not, until the quota period resets.
8. **`503` responses carry `Retry-After`** (seconds).

## Validation reasons

`details[].reason` values are drawn from closed vocabularies:

- Route schema failures: the JSON-Schema keyword -- `required`, `type`,
  `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `enum`,
  `additionalProperties`, `format`.
- Query/body parsing failures: the Zod issue code -- `invalid_type`,
  `too_small`, `too_big`, `invalid_format`, `invalid_value`,
  `unrecognized_keys`, `custom`.
- Domain rules name their own reason in the throwing code
  (e.g. `out_of_range`, `max_depth_exceeded`, `failing`).

## Framework failures

| Situation | Code |
|---|---|
| Body is not valid JSON | `malformed_json` (400) |
| JSON body over 1 MiB | `payload_too_large` (413) |
| Unsupported `Content-Type` | `unsupported_media_type` (415) |
| Schema or parameter validation failed | `validation_failed` (400) |
| No route for method and path | `route_not_found` (404) |
| Any unexpected exception | `internal_error` (500) |

## The v1 taxonomy

Generated from the registry by `scripts/error-codes-table.ts` -- regenerate,
never hand-edit, when a code is added.

| Code | Status | Retryable | Default message |
|---|---|---|---|
| `validation_failed` | 400 | no | The request is invalid. |
| `malformed_json` | 400 | no | The request body is not valid JSON. |
| `invalid_id` | 400 | no | The id is not a valid identifier. |
| `invalid_cursor` | 400 | no | The pagination cursor is invalid. |
| `invalid_transform_param` | 400 | no | A transformation parameter is invalid. |
| `invalid_parameter_combination` | 400 | no | These transformation parameters cannot be combined. |
| `bulk_batch_too_large` | 400 | no | The batch contains too many items. |
| `url_not_allowed` | 400 | no | The URL is not allowed. |
| `authentication_required` | 401 | no | Authentication is required. |
| `api_key_invalid` | 401 | no | The API key is invalid. |
| `session_expired` | 401 | no | The session has expired. |
| `permission_denied` | 403 | no | You do not have permission to do this. |
| `account_suspended` | 403 | no | The account is suspended. |
| `signature_required` | 403 | no | This image requires a signed URL. |
| `signature_invalid` | 403 | no | The URL signature is invalid. |
| `signature_expired` | 403 | no | The signed URL has expired. |
| `referrer_not_allowed` | 403 | no | This referrer is not allowed. |
| `route_not_found` | 404 | no | No route matches this method and path. |
| `application_not_found` | 404 | no | No application with that id exists. |
| `project_not_found` | 404 | no | No project with that id exists. |
| `asset_not_found` | 404 | no | No asset with that id exists. |
| `asset_version_not_found` | 404 | no | No asset version with that id exists. |
| `derivative_not_found` | 404 | no | No derivative exists for this request. |
| `folder_not_found` | 404 | no | No folder with that id exists. |
| `collection_not_found` | 404 | no | No collection with that id exists. |
| `tag_not_found` | 404 | no | No tag with that id exists. |
| `api_key_not_found` | 404 | no | No API key with that id exists. |
| `webhook_not_found` | 404 | no | No webhook with that id exists. |
| `name_already_exists` | 409 | no | A resource with that name already exists. |
| `idempotency_key_reused` | 409 | no | This idempotency key was already used with a different request. |
| `idempotency_request_in_progress` | 409 | yes | A request with this idempotency key is still being processed. |
| `folder_not_empty` | 409 | no | The folder is not empty. |
| `invalid_state` | 409 | no | The resource is not in a state that allows this. |
| `asset_purged` | 410 | no | The asset was permanently deleted after its retention period. |
| `precondition_failed` | 412 | no | A request precondition failed. |
| `payload_too_large` | 413 | no | The request body is too large. |
| `upload_too_large` | 413 | no | The file exceeds the maximum upload size. |
| `unsupported_media_type` | 415 | no | This file type is not supported. |
| `image_decode_failed` | 422 | no | The image could not be decoded. |
| `image_dimensions_exceeded` | 422 | no | The image exceeds the maximum supported dimensions. |
| `upload_incomplete` | 422 | no | The upload has not been completed. |
| `url_fetch_failed` | 422 | no | The image could not be fetched from the URL. |
| `rate_limited` | 429 | yes | Too many requests; slow down. |
| `quota_exceeded` | 429 | no | The plan quota for this period is exhausted. |
| `internal_error` | 500 | no | An unexpected error occurred. |
| `upstream_error` | 502 | yes | An upstream service failed. |
| `service_unavailable` | 503 | yes | The service is temporarily unavailable. |
| `storage_unavailable` | 503 | yes | Storage is temporarily unavailable. |
| `processing_overloaded` | 503 | yes | Image processing is at capacity; retry shortly. |

Delivery-path errors (`/i/{asset_id}`) use the same codes but follow
`docs/IMAGE-DELIVERY-PROTOCOL/24-ERROR-AND-FALLBACK.md` for caching headers.

## Places that must stay consistent with this document

- `packages/errors/src/codes.ts` -- the registry (source of truth).
- `services/api/src/http/error-handler.ts` -- the mapping.
- `docs/DEVELOPER/10-ERRORS.md` -- the consumer-facing reference (`P7-08`).
- Every SDK's error types (`P6-06`, `P6-08`).

## Acceptance Criteria

- [x] The full v1 code taxonomy is listed, generated from the registry.
- [x] Every rule is tested: `packages/errors/src/codes.test.ts` (registry
      invariants, status/retryability by construction, 5xx message
      suppression) and `services/api/tests/error-handling.test.ts`
      (AppError 4xx/5xx, unknown error, Zod and schema validation, malformed
      JSON, oversized body, unsupported media type, no secret or input value
      in any response, log levels).

## Open Questions

- An RFC 9457 (`application/problem+json`) representation could be offered
  later through content negotiation without changing the codes.

## Related Documents

- `docs/API/01-API-STANDARDS.md`, `04-API-VERSIONING.md`
- `docs/ENGINEERING/06-ERROR-RESPONSE-STANDARDS.md`
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/24-ERROR-AND-FALLBACK.md`
