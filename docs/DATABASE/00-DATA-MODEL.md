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
| **Composite foreign keys** `(parent_id, tenant_id) -> parent (id, tenant_id)` | A child whose tenant disagrees with its parent's is unrepresentable, not merely unlikely | Constraint; the migration lint fails any FK into tenant data without `tenant_id` (`data-model.int.test.ts`) |
| A reference between two **project-owned** rows also carries `project_id`: `(parent_id, project_id, tenant_id)` | Linking an asset to another project's folder, tag or collection is unrepresentable (`MULTI-TENANCY/03`, ADR-022) | Constraint; migration lint |
| Entities: `created_at`, `updated_at`, `deleted_at`, all `timestamptz` UTC | Soft delete; auditability | `timestampColumns()` |
| Rows with no lifecycle of their own (join rows, metadata entries, grants, delivery attempts, audit entries, usage buckets) have no `deleted_at`; they are hard-deleted (or never deleted) | A soft-deleted link to a live asset is a state nobody can explain | Per-table documents |
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
| `api_keys`, `api_key_projects` | `api-keys` | tenant | `P1-01` |
| `usage` | `usage` | project | `P1-01` |
| `usage_event_ledger` | `usage` | tenant | `P1-08` |
| `quotas` | `usage` | global | `P1-01` |
| `quota_overrides` | `usage` | tenant | `P1-01` |
| `webhooks`, `webhook_deliveries` | `webhooks` | tenant | `P1-01` |
| `audit_logs` | `audit` | tenant | `P1-01` |
| `idempotency_keys` | `idempotency` | project | `P2-02` (created) |

"global" tables (`tenants`, `quotas`) are explicitly documented as such; every
other table traces to a tenant. The migration lint
(`packages/test-utils/tests/data-model.int.test.ts`) holds the same
classification and fails on any table it does not know, so a new table
cannot skip this decision.

## Supporting tables

Tables that serve a mechanism rather than a domain concept, documented here
rather than in a document of their own.

<!-- schema:idempotency_keys -->
Table `idempotency_keys` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `tenant_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `key` | `text` | no |  |
| `request_hash` | `character(64)` | no |  |
| `status` | `text` | no | `'in_progress'::text` |
| `response_status` | `smallint` | yes |  |
| `response_body` | `jsonb` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `expires_at` | `timestamp with time zone` | no |  |

Constraints:

- `idempotency_keys_completed_ck`: `CHECK (((status <> 'completed'::text) OR ((response_status IS NOT NULL) AND (response_body IS NOT NULL))))`
- `idempotency_keys_key_check`: `CHECK ((((length(key) >= 1) AND (length(key) <= 255)) AND (key !~ '[[:cntrl:]]'::text)))`
- `idempotency_keys_request_hash_check`: `CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text))`
- `idempotency_keys_response_status_check`: `CHECK (((response_status >= 200) AND (response_status <= 599)))`
- `idempotency_keys_status_check`: `CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text])))`
- `idempotency_keys_project_fk`: `FOREIGN KEY (project_id, tenant_id) REFERENCES projects(id, tenant_id) ON DELETE CASCADE`
- `idempotency_keys_pkey`: `PRIMARY KEY (tenant_id, project_id, key)`

Indexes:

- `idempotency_keys_expires_idx`: `(expires_at)`
- `idempotency_keys_project_idx`: `(project_id, tenant_id)`
<!-- /schema:idempotency_keys -->

`idempotency_keys` stores the outcome of a create made with an
`Idempotency-Key` for 24 hours (`docs/API/08`).

## Keeping the documents exact

Each table document embeds a column/constraint/index block generated from
the migrated schema (`<!-- schema:<table> -->`), and
`schema-docs.int.test.ts` fails CI when a document drifts from the schema.
After changing a table: `UPDATE_SCHEMA_DOCS=1 pnpm vitest run --project
integration schema-docs`, then update the prose.

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
