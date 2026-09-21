# 00 - Data Model

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The relational model as a whole: the tenancy hierarchy, the rules every
table follows, and which module owns which table. Individual tables are
specified in `02`..`18`; the diagram of what exists is `01-ERD.md`.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit. Each document specifies one table or table family: its columns,
constraints, indexes, and the invariants the application layer must enforce
on top of the schema.

---

## The hierarchy

```
Tenant                         billing and isolation boundary
  +-- User                     dashboard login (human)
  +-- Application              a customer's product; owns API keys
        +-- Project            an isolated asset space (e.g. "production", "staging")
              +-- Asset
              |     +-- Asset version (original bytes)
              |     |     +-- Derivative (transformed output)
              |     +-- Metadata, tags
              +-- Folder
              +-- Collection
              +-- Usage
```

## Rules every table follows

| Rule | Why | Enforced by |
|---|---|---|
| Primary key `id char(26)`, a ULID, with a `CHECK` on the Crockford-base32 shape | Sortable, non-enumerable, coordination-free (`ADR-003`) | `ulidPrimaryKey()` in `packages/db/src/migrations/ddl.ts` |
| Every tenant-owned row carries `tenant_id`; every project-owned row also carries `project_id`; both `NOT NULL` | `scoped()` filters on them directly, with no join (`ADR-005`) | Migration review; `P1-01` adds a migration-lint check |
| **Composite foreign keys** `(parent_id, tenant_id) -> parent (id, tenant_id)` | A child whose tenant disagrees with its parent's is unrepresentable, not merely unlikely | Constraint; tested (`migrations.int.test.ts`) |
| `created_at`, `updated_at`, `deleted_at`, all `timestamptz` UTC | Soft delete; auditability | `timestampColumns()` |
| `updated_at` maintained by a trigger | Correct even for an `UPDATE` that forgets to set it | `set_updated_at()` trigger |
| Enum-like columns are `text` + `CHECK`, never a Postgres `enum` | Adding a value must not need an exclusive lock | Convention (`docs/ENGINEERING/07`) |
| `ON DELETE RESTRICT` by default | Deleting a parent never silently cascades through tenant data | Constraint |
| Slugs match `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` | Safe in URLs and hostnames | `CHECK` |

## Table ownership

One owning module per table (`docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md`).
Only the owner's repository reads or writes it.

| Table | Owner module | Scope | Created by |
|---|---|---|---|
| `tenants` | `tenancy` | global | `P0-06` |
| `users` | `tenancy` | tenant | `P0-06` |
| `applications` | `tenancy` | tenant | `P0-06` |
| `projects` | `tenancy` | tenant | `P0-06` |
| `assets` | `assets` | project | `P1-01` |
| `asset_versions` | `assets` | project | `P1-01` |
| `asset_metadata` | `assets` | project | `P1-01` |
| `image_derivatives` | `delivery` | project | `P1-01` |
| `folders` | `folders` | project | `P1-01` |
| `collections`, `collection_assets` | `collections` | project | `P1-01` |
| `tags`, `asset_tags` | `tags` | project | `P1-01` |
| `role_assignments` | `tenancy` | tenant | `P1-01` |
| `api_keys` | `api-keys` | tenant | `P1-01` |
| `usage`, `quotas` | `usage` | project / global | `P1-01` |
| `webhooks`, `webhook_deliveries` | `webhooks` | tenant | `P1-01` |
| `audit_logs` | `audit` | tenant | `P1-01` |
| `idempotency_keys` | `idempotency` | project | `P2-02` |

"global" tables (`tenants`, `quotas`) are explicitly documented as such; every
other table traces to a tenant.

## Migrations

Kysely migrations in `packages/db/src/migrations/`, registered statically in
`index.ts` so they are bundled into the deployable (`ADR-019`). Run with
`pnpm db:migrate` locally or `node dist/migrate.js` in the production image,
as an explicit deploy step (`docs/DEVOPS/05-DATABASE-MIGRATION.md`).

## Acceptance Criteria

- [x] The hierarchy, the per-table rules, and table ownership are stated.
- [x] Every rule names its enforcement mechanism.
- [x] The composite-foreign-key rule is verified by a test that attempts the
      cross-tenant insert and asserts the constraint rejects it.

## Open Questions

- Postgres row-level security as defence in depth remains a candidate
  (`ADR-005`), in addition to `scoped()`, never instead of it.

## Related Documents

- `docs/DATABASE/01-ERD.md` .. `18-DATA-RETENTION.md`
- `docs/MULTI-TENANCY/01-TENANT-MODEL.md`, `02-APPLICATION-MODEL.md`, `03-PROJECT-MODEL.md`
- `docs/ENGINEERING/07-REPOSITORY-DATABASE-STANDARDS.md`
- `MEMORY/DECISIONS.md` (`ADR-003`, `ADR-005`, `ADR-019`)
