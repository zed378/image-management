# 07 - Asset Metadata

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Key/value metadata on an asset: custom fields a customer sets (`source =
user`), and values the platform extracts from the file (`source =
extracted`, e.g. copyright from IPTC). Built-in descriptive fields (alt
text, description) are columns on `assets`, not rows here.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:asset_metadata -->
Table `asset_metadata` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `asset_id` | `character(26)` | no |  |
| `source` | `text` | no | `'user'::text` |
| `key` | `text` | no |  |
| `value` | `text` | no |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `asset_metadata_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `asset_metadata_key_check`: `CHECK ((key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'::text))`
- `asset_metadata_source_check`: `CHECK ((source = ANY (ARRAY['user'::text, 'extracted'::text])))`
- `asset_metadata_value_check`: `CHECK ((octet_length(value) <= 2048))`
- `asset_metadata_asset_fk`: `FOREIGN KEY (asset_id, project_id, tenant_id) REFERENCES assets(id, project_id, tenant_id) ON DELETE CASCADE`
- `asset_metadata_pkey`: `PRIMARY KEY (id)`
- `asset_metadata_key_uk`: `UNIQUE (asset_id, source, key)`
<!-- /schema:asset_metadata -->

## Rules

| Rule | Value | Enforced by |
|---|---|---|
| Key shape | lower-case, `^[a-z0-9][a-z0-9_.:-]{0,127}$` (so `iptc:copyright` is valid) | database |
| Value size | at most 2048 bytes (UTF-8) | database |
| One value per key per source per asset | `asset_metadata_key_uk (asset_id, source, key)` | database |
| Entries per asset | at most 100 user entries | service (`P2-06`) |
| Lifecycle | no soft delete: an entry has no life of its own, and rows cascade with a purged asset | database (`ON DELETE CASCADE`) |

Extracted values that are personal data (EXIF GPS, device serials) are
**not** stored: metadata is stripped from derivatives by default
(`SEC-UPL-04`), and storing it here would keep what stripping removes.
Which extracted keys are kept is `P3-06`'s list.

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] Every rule names its enforcement.

## Related Documents

- `docs/DATABASE/05-ASSETS.md`
- `docs/IMAGE-PROCESSING/12` (metadata extraction), `docs/SECURITY/18-DATA-PRIVACY.md`
