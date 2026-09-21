# 10 - Collections

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

A named, ordered set of assets that can span folders -- a curated gallery
rather than a place. An asset can be in any number of collections and in
one folder.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:collections -->
Table `collections` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `name` | `citext` | no |  |
| `description` | `text` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `deleted_at` | `timestamp with time zone` | yes |  |

Constraints:

- `collections_description_check`: `CHECK ((length(description) <= 5000))`
- `collections_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `collections_name_check`: `CHECK ((((length((name)::text) >= 1) AND (length((name)::text) <= 200)) AND ((name)::text = btrim((name)::text))))`
- `collections_project_fk`: `FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id) ON DELETE RESTRICT`
- `collections_pkey`: `PRIMARY KEY (id)`
- `collections_id_project_tenant_uk`: `UNIQUE (id, project_id, tenant_id)`

Indexes:

- `collections_name_uk`: `unique (tenant_id, project_id, name) WHERE (deleted_at IS NULL)`
<!-- /schema:collections -->

<!-- schema:collection_assets -->
Table `collection_assets` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `collection_id` | `character(26)` | no |  |
| `asset_id` | `character(26)` | no |  |
| `position` | `integer` | no |  |
| `created_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `collection_assets_position_check`: `CHECK (("position" >= 0))`
- `collection_assets_asset_fk`: `FOREIGN KEY (asset_id, project_id, tenant_id) REFERENCES assets(id, project_id, tenant_id) ON DELETE RESTRICT`
- `collection_assets_collection_fk`: `FOREIGN KEY (collection_id, project_id, tenant_id) REFERENCES collections(id, project_id, tenant_id) ON DELETE CASCADE`
- `collection_assets_pkey`: `PRIMARY KEY (collection_id, asset_id)`

Indexes:

- `collection_assets_asset_idx`: `(asset_id, project_id, tenant_id)`
- `collection_assets_order_idx`: `(tenant_id, project_id, collection_id, "position")`
<!-- /schema:collection_assets -->

## Rules

| Rule | Value | Enforced by |
|---|---|---|
| Name | 1-200 characters, trimmed; unique among live collections per project, case-insensitive | database |
| Membership | an asset and a collection of the same project and tenant; once per collection | database (composite FKs, primary key) |
| Order | `position`, ascending; the service renumbers on reorder | service |
| Size | at most 10,000 members per collection | service (`P2-06`) |
| Purge | an asset that is still a member cannot be hard-deleted (`collection_assets_asset_fk` RESTRICT, `docs/PLAN/06`); deleting a collection removes its memberships (CASCADE) | database |

## Acceptance Criteria

- [x] The column tables are generated from the migrated schema and checked
      on every CI run.
- [x] The purge restriction is tested.

## Related Documents

- `docs/DATABASE/05-ASSETS.md`, `09-FOLDERS.md`
- `docs/API/17-FOLDER-COLLECTION-API.md`
