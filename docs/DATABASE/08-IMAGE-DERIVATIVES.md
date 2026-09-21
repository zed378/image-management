# 08 - Image Derivatives

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

One row per generated rendition of one asset version: the index from a
`(version, params_hash)` identity to the stored object. It lets delivery
find an existing derivative without touching storage, lets invalidation
enumerate what to purge, and persists per-derivative format decisions.
Derivatives are regenerable and never backed up (`docs/STORAGE/00`).

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:image_derivatives -->
Table `image_derivatives` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `asset_version_id` | `character(26)` | no |  |
| `params_hash` | `text` | no |  |
| `canonical_params` | `text` | no |  |
| `format` | `text` | no |  |
| `status` | `text` | no | `'pending'::text` |
| `storage_key` | `text` | no |  |
| `byte_size` | `bigint` | yes |  |
| `width_px` | `integer` | yes |  |
| `height_px` | `integer` | yes |  |
| `avif_state` | `text` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `image_derivatives_avif_state_check`: `CHECK ((avif_state = ANY (ARRAY['pending'::text, 'unavailable'::text, 'not_beneficial'::text])))`
- `image_derivatives_byte_size_check`: `CHECK ((byte_size > 0))`
- `image_derivatives_canonical_params_check`: `CHECK (((length(canonical_params) >= 1) AND (length(canonical_params) <= 2048)))`
- `image_derivatives_format_check`: `CHECK ((format = ANY (ARRAY['avif'::text, 'webp'::text, 'jpeg'::text, 'png'::text])))`
- `image_derivatives_height_px_check`: `CHECK ((height_px > 0))`
- `image_derivatives_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `image_derivatives_params_hash_check`: `CHECK ((params_hash ~ '^[0-9a-f]{16,128}$'::text))`
- `image_derivatives_ready_ck`: `CHECK (((status <> 'ready'::text) OR ((byte_size IS NOT NULL) AND (width_px IS NOT NULL) AND (height_px IS NOT NULL))))`
- `image_derivatives_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text])))`
- `image_derivatives_storage_key_check`: `CHECK (((length(storage_key) >= 1) AND (length(storage_key) <= 1024)))`
- `image_derivatives_width_px_check`: `CHECK ((width_px > 0))`
- `image_derivatives_version_fk`: `FOREIGN KEY (asset_version_id, project_id, tenant_id) REFERENCES asset_versions(id, project_id, tenant_id) ON DELETE RESTRICT`
- `image_derivatives_pkey`: `PRIMARY KEY (id)`
- `image_derivatives_storage_key_key`: `UNIQUE (storage_key)`

Indexes:

- `image_derivatives_identity_uk`: `unique (tenant_id, project_id, asset_version_id, params_hash)`
<!-- /schema:image_derivatives -->

## Columns that need explaining

| Column | Meaning |
|---|---|
| `params_hash` | The hash of the canonical transformation (`packages/transform-params`, ADR-004): the same value feeds the CDN cache key and the object key. Function and encoding are `P3-02`'s; the column accepts 16-128 lower-case hex characters. |
| `canonical_params` | The serialized canonical form that was hashed (e.g. `dpr=1&f=avif&fit=cover&w=800`), for invalidation and debugging. |
| `format` | The encoded output format actually stored. |
| `storage_key` | `{tenant}/{project}/derivatives/{asset}/{version_id}/{params_hash}.{ext}` (`docs/STORAGE/04`, `P2-01`); unique. |
| `avif_state` | ADR-015/016: why an `f=auto` request did not get AVIF (`pending` while the async encode runs, `unavailable`, `not_beneficial`); `null` when not applicable. |

## Invariants

Enforced by the database:

- **Identity**: `image_derivatives_identity_uk (tenant_id, project_id,
  asset_version_id, params_hash)`. Two concurrent generations of the same
  derivative cannot both be recorded; the insert path handles the conflict
  (`on conflict do nothing` + re-read, `docs/ENGINEERING/07`).
- A derivative belongs to a version in the same project and tenant.
- A `ready` derivative has its size and dimensions.

Enforced by the service:

- A new current version makes every derivative of the previous one stale
  (`docs/IMAGE-DELIVERY-PROTOCOL/17`); they are purged from the CDN and
  deleted by `expire-derivatives`.
- Rows are hard-deleted with their object; there is no soft delete for a
  cache.

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] The identity constraint is tested.

## Related Documents

- `docs/DATABASE/06-ASSET-VERSIONS.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/03` (canonicalization), `12` (format negotiation), `17` (derivative identity)
- `MEMORY/DECISIONS.md` (`ADR-004`, `ADR-015`, `ADR-016`, `ADR-022` point 9)
