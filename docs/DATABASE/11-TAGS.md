# 11 - Tags

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Free-form labels attached many-to-many to assets, indexed for filtering.
Tags are rows (they have ids, `tag_not_found` exists) so a rename is one
update, not a rewrite of every asset.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:tags -->
Table `tags` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `name` | `citext` | no |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |
| `deleted_at` | `timestamp with time zone` | yes |  |

Constraints:

- `tags_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `tags_name_check`: `CHECK ((((length((name)::text) >= 1) AND (length((name)::text) <= 64)) AND ((name)::text = btrim((name)::text)) AND (name !~ '[[:cntrl:]]'::citext)))`
- `tags_project_fk`: `FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id) ON DELETE RESTRICT`
- `tags_pkey`: `PRIMARY KEY (id)`
- `tags_id_project_tenant_uk`: `UNIQUE (id, project_id, tenant_id)`

Indexes:

- `tags_name_uk`: `unique (tenant_id, project_id, name) WHERE (deleted_at IS NULL)`
<!-- /schema:tags -->

<!-- schema:asset_tags -->
Table `asset_tags` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `asset_id` | `character(26)` | no |  |
| `tag_id` | `character(26)` | no |  |
| `created_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `asset_tags_asset_fk`: `FOREIGN KEY (asset_id, project_id, tenant_id) REFERENCES assets(id, project_id, tenant_id) ON DELETE CASCADE`
- `asset_tags_tag_fk`: `FOREIGN KEY (tag_id, project_id, tenant_id) REFERENCES tags(id, project_id, tenant_id) ON DELETE CASCADE`
- `asset_tags_pkey`: `PRIMARY KEY (asset_id, tag_id)`

Indexes:

- `asset_tags_tag_idx`: `(tenant_id, project_id, tag_id, asset_id)`
<!-- /schema:asset_tags -->

## Rules

| Rule | Value | Enforced by |
|---|---|---|
| Normalization | trim; collapse internal whitespace to one space; Unicode NFC | service (before insert) |
| Stored form | 1-64 characters, trimmed, no control characters | database |
| Uniqueness | one live tag per name per project, **case-insensitive** (`citext`): `Beach` and `beach` are one tag; the first spelling is kept | database (`tags_name_uk ... where deleted_at is null`) |
| Per asset | at most 50 tags | service |
| Linking | tag and asset in the same project and tenant | database (composite FKs) |
| Delete | removing a tag removes its links (CASCADE); a purged asset's links go with it | database |

The `tag` filter on asset listing reads `asset_tags_tag_idx (tenant_id,
project_id, tag_id, asset_id)` after resolving the name through
`tags_name_uk`.

## Acceptance Criteria

- [x] The column tables are generated from the migrated schema and checked
      on every CI run.
- [x] Case-insensitive uniqueness, the trim rule and cross-project linking
      are tested.

## Related Documents

- `docs/DATABASE/05-ASSETS.md`
- `docs/SEARCH/` (filtering)
