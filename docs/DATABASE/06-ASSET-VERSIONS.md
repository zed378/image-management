# 06 - Asset Versions

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

One row per stored original. Every re-upload creates a new, immutable
version; the asset's `current_version_id` moves, older versions are kept
for the retention window, and derivatives always belong to exactly one
version.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:asset_versions -->
Table `asset_versions` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `asset_id` | `character(26)` | no |  |
| `version_number` | `integer` | no |  |
| `status` | `text` | no | `'pending'::text` |
| `storage_key` | `text` | no |  |
| `content_type` | `text` | yes |  |
| `byte_size` | `bigint` | yes |  |
| `width_px` | `integer` | yes |  |
| `height_px` | `integer` | yes |  |
| `checksum_sha256` | `character(64)` | yes |  |
| `focal_x` | `double precision` | yes |  |
| `focal_y` | `double precision` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `deleted_at` | `timestamp with time zone` | yes |  |

Constraints:

- `asset_versions_byte_size_check`: `CHECK ((byte_size > 0))`
- `asset_versions_checksum_sha256_check`: `CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text))`
- `asset_versions_content_type_check`: `CHECK ((content_type ~ '^image/[a-z0-9.+-]+$'::text))`
- `asset_versions_focal_ck`: `CHECK (((focal_x IS NULL) = (focal_y IS NULL)))`
- `asset_versions_focal_x_check`: `CHECK (((focal_x >= (0)::double precision) AND (focal_x <= (1)::double precision)))`
- `asset_versions_focal_y_check`: `CHECK (((focal_y >= (0)::double precision) AND (focal_y <= (1)::double precision)))`
- `asset_versions_height_px_check`: `CHECK ((height_px > 0))`
- `asset_versions_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `asset_versions_ready_ck`: `CHECK (((status <> 'ready'::text) OR ((content_type IS NOT NULL) AND (byte_size IS NOT NULL) AND (width_px IS NOT NULL) AND (height_px IS NOT NULL) AND (checksum_sha256 IS NOT NULL))))`
- `asset_versions_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text])))`
- `asset_versions_storage_key_check`: `CHECK (((length(storage_key) >= 1) AND (length(storage_key) <= 1024)))`
- `asset_versions_version_number_check`: `CHECK ((version_number >= 1))`
- `asset_versions_width_px_check`: `CHECK ((width_px > 0))`
- `asset_versions_asset_fk`: `FOREIGN KEY (asset_id, project_id, tenant_id) REFERENCES assets(id, project_id, tenant_id) ON DELETE RESTRICT`
- `asset_versions_pkey`: `PRIMARY KEY (id)`
- `asset_versions_id_asset_uk`: `UNIQUE (id, asset_id, project_id, tenant_id)`
- `asset_versions_id_project_tenant_uk`: `UNIQUE (id, project_id, tenant_id)`
- `asset_versions_number_uk`: `UNIQUE (asset_id, version_number)`
- `asset_versions_storage_key_key`: `UNIQUE (storage_key)`
<!-- /schema:asset_versions -->

## Columns that need explaining

| Column | Meaning |
|---|---|
| `version_number` | 1, 2, 3 ... per asset, for display and the versions API. Unique per asset. The id, not the number, is used in object keys. |
| `status` | `pending` until the bytes are stored and validated, then `ready` or `failed`. |
| `storage_key` | The object key, stored rather than recomputed: `{tenant}/{project}/originals/{asset}/{version_id}.{ext}` today (`docs/STORAGE/04`, `P2-01`). Unique, so two rows can never own one object. |
| `content_type`, `byte_size`, `width_px`, `height_px`, `checksum_sha256` | Facts read from the bytes, not from the request. `null` while `pending`; all required once `ready` (`asset_versions_ready_ck`). `checksum_sha256` is lower-case hex. |
| `focal_x`, `focal_y` | Optional focus point in `[0,1] x [0,1]`, origin top-left (`docs/IMAGE-DELIVERY-PROTOCOL/09`); both or neither. Set per version because a crop is a property of the pixels (`P3-04`). |

## Invariants

Enforced by the database:

- A version belongs to an asset in the same project and tenant.
- A `ready` version has every bytes-derived fact.
- Versions are RESTRICT-deleted: the purge job deletes the object, then the
  row, and never loses the pointer to an object it has not deleted.

Enforced by the service:

- A version is immutable once `ready`: its bytes and facts never change; a
  new upload is a new version.
- Promoting an older version (`P2-05`) moves `assets.current_version_id` and
  invalidates the previous current version's derivatives.

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] The ready-facts and same-asset rules are tested.

## Related Documents

- `docs/DATABASE/05-ASSETS.md`, `08-IMAGE-DERIVATIVES.md`
- `docs/STORAGE/04-OBJECT-NAMING.md`
- `MEMORY/DECISIONS.md` (`ADR-022` points 7-8)
