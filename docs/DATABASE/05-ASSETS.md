# 05 - Assets

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The core resource: one row per logical image in a project. The bytes live
in immutable versions ([`06-ASSET-VERSIONS.md`](./06-ASSET-VERSIONS.md));
the asset holds what is true across versions -- where it is filed, who can
see it, its lifecycle state, and its descriptive text -- plus a pointer to
the current version.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:assets -->
Table `assets` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `folder_id` | `character(26)` | yes |  |
| `current_version_id` | `character(26)` | yes |  |
| `original_filename` | `text` | no |  |
| `status` | `text` | no | `'pending'::text` |
| `visibility` | `text` | no | `'private'::text` |
| `alt_text` | `text` | yes |  |
| `description` | `text` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `deleted_at` | `timestamp with time zone` | yes |  |

Constraints:

- `assets_alt_text_check`: `CHECK ((length(alt_text) <= 1000))`
- `assets_description_check`: `CHECK ((length(description) <= 5000))`
- `assets_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `assets_original_filename_check`: `CHECK (((length(original_filename) >= 1) AND (length(original_filename) <= 255)))`
- `assets_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text])))`
- `assets_visibility_check`: `CHECK ((visibility = ANY (ARRAY['private'::text, 'public'::text, 'unlisted'::text, 'signed'::text, 'expiring'::text])))`
- `assets_current_version_fk`: `FOREIGN KEY (current_version_id, id, project_id, tenant_id) REFERENCES asset_versions(id, asset_id, project_id, tenant_id) ON DELETE RESTRICT`
- `assets_folder_fk`: `FOREIGN KEY (folder_id, project_id, tenant_id) REFERENCES folders(id, project_id, tenant_id) ON DELETE RESTRICT`
- `assets_project_fk`: `FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id) ON DELETE RESTRICT`
- `assets_pkey`: `PRIMARY KEY (id)`
- `assets_id_project_tenant_uk`: `UNIQUE (id, project_id, tenant_id)`

Indexes:

- `assets_deleted_idx`: `(deleted_at) WHERE (deleted_at IS NOT NULL)`
- `assets_folder_idx`: `(tenant_id, project_id, folder_id, created_at DESC)`
- `assets_listing_idx`: `(tenant_id, project_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL)`
- `assets_pending_idx`: `(created_at) WHERE (status = 'pending'::text)`
<!-- /schema:assets -->

## Columns that need explaining

| Column | Meaning |
|---|---|
| `current_version_id` | The version delivery serves. `null` until the first version is stored. The composite FK names `(current_version_id, id, ...)`, so the pointer can only name **this** asset's version. |
| `original_filename` | The uploader's filename, kept for display and `Content-Disposition`. Untrusted: never a path, an object key, or an unencoded header value (`SEC-UPL-06`). |
| `status` | `pending` -- created, bytes not yet received (presigned upload in flight); `processing` -- bytes received, validation/extraction running; `ready` -- deliverable; `failed` -- validation or processing failed, with the reason in the event and log. |
| `visibility` | `private` (default), `public`, `unlisted`, `signed`, `expiring` (`docs/PLAN/21`); semantics are `P5-01`'s. Any other value is rejected by the database, so an unknown level can never fail open. |
| `alt_text`, `description` | Built-in descriptive fields (`P2-06`); custom key/value metadata lives in [`07`](./07-ASSET-METADATA.md). |
| `deleted_at` | Soft delete: the asset disappears from listings and delivery; restorable until the retention window ends ([`18`](./18-DATA-RETENTION.md)). There is no `deleted` status (ADR-022). |

Size, dimensions, content type and checksum are facts about bytes, so they
live on the version; listing joins through `current_version_id` (ADR-022
point 7).

## Invariants

Enforced by the database (tested in `data-model.int.test.ts`):

- The asset, its folder, and its current version are in the same project and
  tenant (composite FKs over `(id, project_id, tenant_id)`).
- `status` and `visibility` take only the listed values.
- A hard delete is refused while the asset is in a collection
  (`collection_assets_asset_fk`, RESTRICT) or still has versions.

Enforced by the service:

- Every read filters `deleted_at is null` (`docs/ENGINEERING/07`).
- Status moves forward only: `pending -> processing -> ready | failed`; a new
  version moves a `ready` asset back to `processing` until it is ready.
- The purge job removes an asset only after its retention window, deleting
  derivatives' and versions' objects before their rows.

## Query patterns and indexes

| Query | Index |
|---|---|
| Default listing, newest first, cursor on the ULID tie-breaker | `assets_listing_idx (tenant_id, project_id, created_at desc, id desc) where deleted_at is null` |
| List one folder; the folder FK's restrict check | `assets_folder_idx (tenant_id, project_id, folder_id, created_at desc)` |
| `purge-deleted-assets` | `assets_deleted_idx (deleted_at) where deleted_at is not null` |
| `sweep-pending-uploads` | `assets_pending_idx (created_at) where status = 'pending'` |

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run (`schema-docs.int.test.ts`).
- [x] Every invariant names whether the database or the service enforces it,
      and the database ones are tested.

## Related Documents

- `docs/DATABASE/06-ASSET-VERSIONS.md`, `07-ASSET-METADATA.md`, `09-FOLDERS.md`, `10-COLLECTIONS.md`, `11-TAGS.md`
- `docs/PLAN/21` (visibility levels), `docs/SECURITY/00` (`SEC-UPL-06`)
- `MEMORY/DECISIONS.md` (`ADR-003`, `ADR-005`, `ADR-022`)
