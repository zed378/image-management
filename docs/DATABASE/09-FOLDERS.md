# 09 - Folders

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

A user-defined hierarchy for organizing assets inside a project. Folders are
an organizing view only: they are independent of object storage naming, so
moving an asset between folders never moves bytes.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:folders -->
Table `folders` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `parent_id` | `character(26)` | yes |  |
| `name` | `citext` | no |  |
| `path` | `citext` | no |  |
| `depth` | `smallint` | no |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `deleted_at` | `timestamp with time zone` | yes |  |

Constraints:

- `folders_depth_check`: `CHECK (((depth >= 1) AND (depth <= 16)))`
- `folders_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `folders_name_check`: `CHECK ((((length((name)::text) >= 1) AND (length((name)::text) <= 128)) AND ((name)::text = btrim((name)::text)) AND (POSITION(('/'::text) IN (name)) = 0) AND (name !~ '[[:cntrl:]]'::citext)))`
- `folders_path_check`: `CHECK (((path ~ '^/'::citext) AND (length((path)::text) <= 2100)))`
- `folders_root_depth_ck`: `CHECK (((parent_id IS NULL) = (depth = 1)))`
- `folders_parent_fk`: `FOREIGN KEY (parent_id, project_id, tenant_id) REFERENCES folders(id, project_id, tenant_id) ON DELETE RESTRICT`
- `folders_project_fk`: `FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id) ON DELETE RESTRICT`
- `folders_pkey`: `PRIMARY KEY (id)`
- `folders_id_project_tenant_uk`: `UNIQUE (id, project_id, tenant_id)`

Indexes:

- `folders_parent_idx`: `(tenant_id, project_id, parent_id)`
- `folders_path_uk`: `unique (tenant_id, project_id, path) WHERE (deleted_at IS NULL)`
<!-- /schema:folders -->

## Rules

| Rule | Value | Enforced by |
|---|---|---|
| Name | 1-128 characters, trimmed, no `/`, no control characters | database |
| Name characters | `^[\w][\w .-]*$` (letters, digits, `_`, space, `.`, `-`) | service (stricter than the database) |
| Path | `'/' + ancestors' names + name`, e.g. `/campaigns/2026/spring` | service computes; database checks the leading `/` |
| Uniqueness | one live folder per path per project, case-insensitive (`citext`) | database (`folders_path_uk ... where deleted_at is null`) |
| Depth | 1-16; a root has depth 1 and no parent, a child has a parent | database (`folders_root_depth_ck`) |
| Parent | in the same project and tenant | database (composite FK) |
| Delete | a folder with live children or assets is refused (`folder_not_empty`, 409); `folders_parent_fk` and `assets_folder_fk` RESTRICT a hard delete | service + database |

`path` is materialized so a lookup by path and the uniqueness check are one
index probe. Renaming or moving a folder rewrites the `path` (and `depth`)
of every descendant in one transaction (`P2-06`).

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] Path uniqueness (including reuse after soft delete) and the root/depth
      rule are tested.

## Related Documents

- `docs/DATABASE/05-ASSETS.md`
- `docs/API/17-FOLDER-COLLECTION-API.md`
- `docs/ENGINEERING/05-LAYER-TEMPLATES.md` (the folder module worked example)
