# 03 - Applications

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

An application is one of a tenant's products that consumes the platform --
"the storefront", "the mobile app". It is the unit API keys and signed-URL
secrets are issued to, and it groups projects.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

## Table `applications`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | `char(26)` | no | -- | PK, ULID check |
| `tenant_id` | `char(26)` | no | -- | FK `tenants(id)` `ON DELETE RESTRICT` |
| `name` | `text` | no | -- | length 1-200 |
| `slug` | `text` | no | -- | slug pattern; `UNIQUE (tenant_id, slug)` |
| `status` | `text` | no | `'active'` | `active`, `suspended` |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` | `updated_at` by trigger |
| `deleted_at` | `timestamptz` | yes | -- | soft delete |

Constraints: `applications_tenant_slug_uk (tenant_id, slug)`,
`applications_id_tenant_uk (id, tenant_id)` -- the target of composite
foreign keys from `projects` and every later application-owned table.

## Invariants

- A suspended application's API keys fail authentication (`P1-03`); its
  public delivery URLs keep working unless the tenant is suspended, so a
  suspension of API access does not break a live website.
- Slugs are unique per tenant, not globally.

## Acceptance Criteria

- [x] Column list matches the migration exactly.

## Related Documents

- `docs/MULTI-TENANCY/02-APPLICATION-MODEL.md`
- `docs/DATABASE/04-PROJECTS.md`, `13-API-KEYS.md`
