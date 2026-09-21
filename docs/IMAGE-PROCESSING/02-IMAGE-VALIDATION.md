# 02 - Image Validation

> Category: **Image Processing** (`docs/IMAGE-PROCESSING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Reject an invalid upload before it consumes any processing: type from the
bytes, size and dimension limits, malformed files -- all before a single
pixel is decoded. Implemented once, `inspectImage` in
`packages/image-engine/src/inspect.ts`, used by every ingestion path.

## Category Mandate

Specifies the deterministic pipeline that turns an original asset plus a
set of requested parameters into a derivative image. Determinism matters:
the same asset + the same parameter set must always produce a byte-identical
(or acceptably equivalent) result, because that identity is the cache key.

---

## The checks, in order

| # | Check | Limit | Failure |
|---|---|---|---|
| 1 | Size | 1 byte .. 25 MiB (`UPLOAD_MAX_BYTES`); the multipart stream is cut at the limit | `422 image_decode_failed` (empty), `413 upload_too_large` |
| 2 | Magic bytes | JPEG `FF D8 FF`; PNG signature; `GIF87a`/`GIF89a`; `RIFF....WEBP`; `ftypavif`/`ftypavis`; TIFF `II*\0`/`MM\0*` | `415 unsupported_media_type` |
| 3 | Header dimensions | each side <= 16,384 px (`UPLOAD_MAX_DIMENSION_PX`); width x height <= 50,000,000 (`UPLOAD_MAX_PIXELS`); frames <= 100 (`UPLOAD_MAX_PAGES`) | `422 image_dimensions_exceeded` |
| 4 | Decoder agreement | the format libvips reads from the header equals the sniffed type (a polyglot is refused) | `415 unsupported_media_type` |
| -- | Unreadable header | a valid signature over a truncated or corrupt file | `422 image_decode_failed` |

Order matters: nothing reads past the size check, nothing trusts a name
before the magic bytes, and **nothing decodes before the header check** --
libvips reads metadata without decoding pixels, so a decompression bomb (a
tiny file declaring 100,000 x 100,000) is refused in milliseconds instead
of allocating tens of gigabytes. Tested with a crafted file.

The declared `Content-Type` and the filename are **never** consulted
(`SEC-UPL-01`): an HTML file named `photo.jpg` sent as `image/jpeg` is
`415`. SVG is not an accepted input (`SEC-UPL-03`).

## Facts recorded

`inspectImage` returns what the version row stores: media type, byte size,
width and height *as displayed* (EXIF orientation applied), the
orientation angle (for `rot=auto`), alpha, frame count, and the SHA-256
checksum of the bytes.

## Out of scope here

Full decoding, re-encoding, metadata stripping and resource limits on
decode are the worker's (`P3-01`, `SEC-UPL-04`/`05`). HEIC is not accepted
in v1 (the prebuilt libvips carries HEIF only for AVIF).

## Acceptance Criteria

- [x] Every limit is a named constant with its value stated.
- [x] Every check is tested (`packages/image-engine/src/inspect.test.ts`,
      `services/api/tests/assets-upload.int.test.ts`).

## Related Documents

- `docs/API/11-UPLOAD-API.md`, `docs/ASSET/02-ASSET-UPLOAD.md`
- `docs/SECURITY/13-UPLOAD-SECURITY.md`, `14-MALICIOUS-FILE-PREVENTION.md`
