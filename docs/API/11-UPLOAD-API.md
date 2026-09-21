# 11 - Upload API

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Final (v1 -- direct upload; presigned upload lands in P2-03) &nbsp;|&nbsp; Owner: TBD

## Purpose

How a client puts an original image into the platform. v1 has two paths:
**direct** multipart upload through the API (this document, `P2-02`) and
**presigned** upload straight to storage (`P2-03`, added here when built).

## Category Mandate

The platform is API-first. Every capability exposed to a consumer
application is defined here as a versioned, documented HTTP contract before
it is implemented. These documents are the source of truth for
request/response shapes, status codes, and error formats -- SDKs and the
dashboard are clients of this contract, not the other way around.

---

## Direct upload

```http
POST /v1/projects/{project_id}/assets
Authorization: Bearer ak_live_...
Idempotency-Key: 5f1c...            (optional, recommended)
Content-Type: multipart/form-data; boundary=...

--...
Content-Disposition: form-data; name="file"; filename="beach.jpg"
Content-Type: image/jpeg

<bytes>
--...
Content-Disposition: form-data; name="alt_text"

A beach at dusk
--...--
```

Permission: `asset:create`. The project must be within the key's coverage
and not archived.

| Form field | Required | Constraint |
|---|---|---|
| `file` | yes | exactly one; at most 25 MiB (`UPLOAD_MAX_BYTES`) |
| `folder_id` | no | a folder of this project |
| `visibility` | no | `private` (default), `public`, `unlisted`, `signed`, `expiring` |
| `alt_text` | no | at most 1000 characters |
| `description` | no | at most 5000 characters |

Any other field is `400 validation_failed`. At most 10 text fields of 8 KB.

### What is accepted

The type is decided by the **bytes**, never by the filename or the declared
`Content-Type` (`SEC-UPL-01`): JPEG, PNG, WebP, AVIF, GIF, TIFF. Each side at
most 16,384 px, at most 50,000,000 pixels, at most 100 frames -- all read
from the file's header, **before any decoding** (image-bomb protection,
`SEC-UPL-02`). SVG is refused (`SEC-UPL-03`). Details:
`docs/IMAGE-PROCESSING/02-IMAGE-VALIDATION.md`.

### Response

`201 Created`, `Location: /v1/projects/{project_id}/assets/{asset_id}`:

```json
{
  "data": {
    "id": "01J...",
    "project_id": "01J...",
    "folder_id": null,
    "original_filename": "beach.jpg",
    "status": "processing",
    "visibility": "private",
    "alt_text": "A beach at dusk",
    "description": null,
    "current_version": {
      "id": "01J...", "version": 1, "content_type": "image/jpeg",
      "byte_size": 482113, "width": 4000, "height": 3000,
      "checksum_sha256": "9f2c...", "created_at": "2026-09-21T12:00:00.000Z"
    },
    "created_at": "2026-09-21T12:00:00.000Z",
    "updated_at": "2026-09-21T12:00:00.000Z"
  },
  "meta": { "request_id": "01J..." }
}
```

`status` is `processing` until Phase 3 marks the asset `ready`.
`original_filename` is display text only: reduced to a basename, control
characters removed; it never becomes a key or a path (`SEC-UPL-06`).

### Errors

| Status | Code | When |
|---|---|---|
| 400 | `validation_failed` | no `file`, an unknown field, a malformed field |
| 401 / 403 | `authentication_required`, `api_key_invalid` / `permission_denied` | `docs/API/02` |
| 404 | `project_not_found` | not in the key's coverage, or not this tenant's |
| 404 | `folder_not_found` | `folder_id` not in this project |
| 409 | `invalid_state` | the project is archived |
| 409 | `idempotency_key_reused`, `idempotency_request_in_progress` | `docs/API/08` |
| 413 | `upload_too_large` | over 25 MiB (the stream is cut off at the limit) |
| 415 | `unsupported_media_type` | not an accepted format by its bytes, or not multipart |
| 422 | `image_dimensions_exceeded` | header dimensions, pixels or frames over the limits |
| 422 | `image_decode_failed` | a truncated or corrupt file with a valid signature |
| 503 | `storage_unavailable` | storage failed; nothing was created |

A rejected upload leaves nothing behind: no rows, no object (tested).

## Reading an asset

`GET /v1/projects/{project_id}/assets/{asset_id}` -- permission
`asset:read`; `200` with the shape above, `404 asset_not_found` for an
asset that does not exist, is deleted, or is another tenant's.

## Acceptance Criteria

- [x] Every field, limit, status and error is stated and tested
      (`services/api/tests/assets-upload.int.test.ts`,
      `packages/image-engine/src/inspect.test.ts`).
- [x] The isolation case exists for both routes (`tests/isolation/cases.ts`).

## Related Documents

- `docs/API/08-IDEMPOTENCY.md`, `10-ASSET-API.md`
- `docs/ASSET/02-ASSET-UPLOAD.md`, `docs/IMAGE-PROCESSING/02-IMAGE-VALIDATION.md`
- `docs/SECURITY/00` (`SEC-UPL-*`), `13-UPLOAD-SECURITY.md`
