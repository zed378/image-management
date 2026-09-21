# 04 - Projects

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

A project is an isolated asset space inside an application -- typically one
per environment ("production", "staging") or per product area. Every asset,
folder, collection, tag, derivative, and usage row belongs to exactly one
project, and `scoped()` filters on `project_id` directly.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

## Table `projects`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | `char(26)` | no | -- | PK, ULID check |
| `tenant_id` | `char(26)` | no | -- | part of composite FK |
| `application_id` | `char(26)` | no | -- | FK `(application_id, tenant_id) -> applications (id, tenant_id)` |
| `name` | `text` | no | -- | length 1-200 |
| `slug` | `text` | no | -- | slug pattern; `UNIQUE (application_id, slug)` |
| `settings` | `jsonb` | no | `'{}'` | must be a JSON object |
| `status` | `text` | no | `'active'` | `active`, `archived` |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` | `updated_at` by trigger |
| `deleted_at` | `timestamptz` | yes | -- | soft delete |

Indexes and constraints: `projects_pkey`, `projects_application_slug_uk`,
`projects_id_tenant_uk (id, tenant_id)` (target for composite FKs from every
project-owned table), `projects_tenant_id_idx (tenant_id)`.

## `settings`

Per-project runtime behaviour. Unknown keys are ignored; absent keys take
the default.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `dimension_ladder` | boolean | `false` | Snap `w`/`h` to the width ladder (`ADR-014`) |
| `strict_parameters` | boolean | `false` | Reject foreign query parameters too (`ADR-013`) |

Later tasks add keys (referrer allow-list `P5-05`, default visibility
`P5-01`); each adds its row here.

## Invariants

- **The composite foreign key** means a project's `tenant_id` always equals
  its application's; a mismatched insert is rejected by the database
  (verified by `migrations.int.test.ts`).
- An archived project rejects writes but continues to serve delivery, so
  archiving does not break a live site.

## Acceptance Criteria

- [x] Column list matches the migration exactly.
- [x] The composite-FK invariant is tested.

## Related Documents

- `docs/MULTI-TENANCY/03-PROJECT-MODEL.md`
- `docs/DATABASE/00-DATA-MODEL.md`
- `MEMORY/DECISIONS.md` (`ADR-005`, `ADR-013`, `ADR-014`)
