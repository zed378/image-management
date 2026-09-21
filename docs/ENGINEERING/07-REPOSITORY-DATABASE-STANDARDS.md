# 07 - Repository & Database Standards

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands sections 9, 15, and 21 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

This is the document that keeps the platform multi-tenant. ADR-005 chose
query-layer enforcement over API-layer-only checks precisely because an
authorization check in a controller is one forgotten `where` clause away
from a cross-tenant leak. That decision is only real if the query layer
makes the mistake unexpressible -- which is what `scoped()` is for.

The concrete query tool is chosen in `P0-06`. Everything here is a contract
that choice must satisfy.

## `scoped()` -- the only door

```ts
// packages/db/src/scoped.ts
const TENANT_OWNED_TABLES = {
  assets:            { tenant: "tenant_id", project: "project_id" },
  asset_versions:    { tenant: "tenant_id", project: "project_id" },
  derivatives:       { tenant: "tenant_id", project: "project_id" },
  folders:           { tenant: "tenant_id", project: "project_id" },
  webhooks:          { tenant: "tenant_id", project: "project_id" },
  api_keys:          { tenant: "tenant_id", project: "project_id" },
  usage_records:     { tenant: "tenant_id", project: "project_id" },
  audit_log_entries: { tenant: "tenant_id", project: null },
  projects:          { tenant: "tenant_id", project: null },
} as const;

export type TenantOwnedTable = keyof typeof TENANT_OWNED_TABLES;

/**
 * The only sanctioned entry point to a tenant-owned table.
 * Injects the tenant (and project, where the table has one) predicate
 * into SELECT, UPDATE, and DELETE, and the columns into INSERT.
 */
export const scoped = <TRow>(
  ctx: TenantContext,
  table: TenantOwnedTable,
  tx?: Tx,
): ScopedQuery<TRow> => { /* ... */ };
```

Properties the implementation MUST have -- these are the acceptance criteria
for `P0-06`'s choice, and for the `P1-05` task that builds it:

1. The scope predicate is added **by construction**, not by a caller
   remembering to chain `.forTenant()`. A caller cannot obtain an unscoped
   builder from `scoped()`.
2. It applies to reads *and* writes. An `UPDATE` without the predicate can
   overwrite another tenant's row; a `DELETE` without it is worse.
3. It cannot be removed downstream. A chained `.where({ tenant_id: other })`
   must not replace the injected predicate -- an `AND` of two tenant ids
   matches nothing, which is the correct failure.
4. `INSERT` sets `tenant_id`/`project_id` from `ctx`, and **ignores** any
   value supplied in the payload. Accepting a payload-supplied tenant id is
   a cross-tenant write primitive.
5. The table list is exhaustive and typed. A new tenant-owned table that is
   not in `TENANT_OWNED_TABLES` fails to compile at its first `scoped()`
   call, which is the point at which someone notices.
6. Adding a table to that map is a `docs/MULTI-TENANCY/` change and a test
   in the `P1-06` IDOR suite, in the same pull request.

## Repository rules

- `ctx: TenantContext` is the first parameter of every function. MUST.
- Every query on a tenant-owned table goes through `scoped()`. MUST. Raw SQL
  or a raw builder against such a table outside `packages/db` is a
  review-blocking finding (ADR-005), enforced by lint
  (`no-restricted-imports` on the query-layer module from `**/*.repository.ts`
  other than via `@image-delivery/db`).
- Return domain types via a mapper; never a raw row. A leaked row spreads
  `snake_case` upward and makes a column rename an API break.
- A repository MUST NOT: hold business rules, throw a not-found `AppError`, call
  another repository, enqueue a job, invalidate a cache, or open a
  transaction. It accepts `tx?` and uses it when given.
- `find*` returns `T | null`; `get*` does not exist at this layer.
- Explicit column lists; no `SELECT *`.
- Every read filters `deleted_at: null` explicitly -- there is no hidden
  default, because a filter nobody writes is a filter nobody checks.

## The escape hatch

Some code legitimately crosses tenants: tenant provisioning, the admin API
(`docs/API/20-ADMIN-API.md`), usage aggregation, the orphan sweeper.

```ts
/**
 * Bypasses tenant scoping. Every call site must name a reason, which is
 * logged at warn level. Banned in services/* by lint; permitted only in
 * admin and maintenance contexts, each with a test proving a non-admin
 * caller is rejected.
 */
export const unsafeUnscoped = <TRow>(
  table: string,
  reason: UnscopedReason,
): Query<TRow> => { /* ... */ };
```

Rules:

- The name is deliberately ugly. It should be uncomfortable to read in a
  diff, and it should be greppable in an audit.
- `UnscopedReason` is a closed union, not a string. A new reason is a
  reviewed change.
- Every call site: an explicit permission check, an audit log entry
  (`docs/SECURITY/`), and a test that a caller without that permission is
  rejected.
- Banned in `services/*` by lint; permitted in the admin surface and
  `jobs/maintenance/*`.

## Schema standards

| Concern | Rule |
|---|---|
| Table names | `snake_case`, plural: `asset_versions` |
| Column names | `snake_case`: `content_type`, `params_hash` |
| Primary key | ULID, `char(26)` (or as `P0-06` records) -- never serial (ADR-003) |
| Tenant columns | `tenant_id` and `project_id`, both `not null`, leading columns of the table's indexes |
| Timestamps | `created_at`, `updated_at`, `deleted_at`, all `timestamptz`, all UTC |
| Soft delete | `deleted_at is null` means live; every read filters it |
| Enum-like | `text` + `check` constraint, never a Postgres `enum` type |
| Foreign keys | Declared, with an explicit `on delete` (default `restrict`) |
| Quantities | Integer, unit in the name: `byte_size`, `width_px`, `ttl_seconds` |
| Uniqueness | A database constraint, not only an application check |

The uniqueness rule is where this platform's correctness actually lives.
Two constraints are load-bearing:

```sql
-- Idempotency: a retried create must not produce a second asset.
create unique index assets_idempotency_uk
  on assets (tenant_id, project_id, idempotency_key)
  where idempotency_key is not null;

-- Derivative identity (ADR-004/009): one derivative per (version, params).
create unique index derivatives_identity_uk
  on derivatives (tenant_id, project_id, asset_version_id, params_hash);
```

The second one is the database's independent guarantee of the invariant
`packages/transform-params` exists to maintain. If the hash function were
ever called twice with a race between them, the constraint is what prevents
two stored objects for one logical derivative -- so the insert path must
handle the conflict (`on conflict do nothing` + re-read), not assume it
cannot happen.

## Query standards

- **No N+1.** A loop containing `await repository.findById` is a review
  finding. Batch with `where id in (...)` or a join, and give the batch
  function a plural name (`findManyByIds`).
- **Cursor pagination**, on the ULID primary key, never `OFFSET` on tenant
  data. ULIDs are time-sortable (ADR-003), which is exactly why they were
  chosen. See `docs/API/07-PAGINATION.md`.
- **Transactions are owned by the service.** A transaction MUST NOT contain
  a storage call, an HTTP call, a webhook delivery, or a queue publish that
  the transaction's success depends on. Commit, then enqueue.
- **Statement timeout** is set on the pool from config. A query with no
  timeout can hold a connection until the pool starves.
- **`SELECT ... FOR UPDATE`** only with a stated lock ordering, and never
  across two tables in two different orders in two code paths -- that is a
  deadlock with a long fuse.
- **Read-your-writes**: after a commit, a read on the same request uses the
  primary, not a replica.

## Index standards

- Every index's migration comment names the query it serves. An index with
  no named query is dead weight or a guess, and both cost write throughput.
- Composite column order is equality columns first, then the range or sort
  column: `(tenant_id, project_id, created_at desc)` serves the default
  asset listing, and no other order does.
- `CREATE INDEX CONCURRENTLY`, in its own migration, outside a transaction,
  for any populated table.
- Measure with `EXPLAIN (ANALYZE, BUFFERS)` against realistic row counts and
  put the plan in the task's `MEMORY/` record. "It seemed faster" is not a
  measurement, and the next person cannot verify it.

## Migration standards

See section 21 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md) for
the full list. The rule that matters most operationally:

**Migrations are additive and forward-only in production.** Removing a
column is three deploys -- stop writing, stop reading, drop -- which is what
makes a rollback to the previous application version safe at any point. A
migration that drops a column the previous version still reads turns a
rollback into a data incident.

A migration touching more than ~100k rows is a batched, resumable backfill
job, not a migration. A migration that holds a lock for minutes is an
outage, and Postgres will queue every subsequent query behind it.

## Acceptance Criteria

- [x] The six properties `scoped()` must have are stated as testable
      requirements, including the INSERT and UPDATE cases that an
      API-layer-only check would miss.
- [x] The escape hatch is specified with its restrictions rather than left
      implicit.
- [x] The two load-bearing unique constraints are given as SQL, with the
      invariant each protects named.

## Open Questions

- `P0-06` picks Prisma, Drizzle, or Knex. `scoped()`'s six properties are
  the selection criteria -- an ORM that cannot express property 3 (a
  predicate a caller cannot remove) makes ADR-005 unenforceable and should
  lose on that basis alone.
- Whether Postgres row-level security is added as defence in depth is left
  open by ADR-005; if added, it is *in addition to* `scoped()`, never
  instead of it.
- `char(26)` versus `uuid`-with-ULID-bytes for the primary key column type
  is a `P0-06` decision; index size and the debugging cost of an unreadable
  id are the trade-off.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (sections 9, 15, 21)
- `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`
- `docs/DATABASE/` (the relational data model)
- `docs/API/07-PAGINATION.md`, `docs/API/08-IDEMPOTENCY.md`
- `docs/DEVOPS/05-DATABASE-MIGRATION.md`, `docs/DEVOPS/10-ROLLBACK.md`
- `MEMORY/DECISIONS.md` (`ADR-003`, `ADR-004`, `ADR-005`, `ADR-009`)
- `TASKS/PHASE-1-TENANCY-AUTH.md` (`P1-05` builds `scoped()`, `P1-06` gates it)
