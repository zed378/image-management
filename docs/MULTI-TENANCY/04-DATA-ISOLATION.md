# 04 - Data Isolation

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The concrete mechanisms that keep each tenant's data apart in every store
the platform writes to: PostgreSQL, object storage, and caches.

## Category Mandate

The platform is consumed by many independent applications (tenants), each
with its own assets, quotas, and CDN configuration. Multi-tenancy is
treated as a fundamental, load-bearing requirement, not an afterthought: a
request scoped to Tenant A must never be able to read, modify, or enumerate
Tenant B's resources under any circumstance.

---

## PostgreSQL

| Mechanism | Detail | Enforced by |
|---|---|---|
| `tenant_id NOT NULL` on every tenant-owned table, `project_id NOT NULL` on every project-owned one | Two global tables only: `tenants`, `quotas` | migration lint (`packages/test-utils/tests/data-model.int.test.ts`) |
| Composite foreign keys carry `tenant_id` (and `project_id` between project-owned rows) | A cross-tenant or cross-project link is unrepresentable | constraints; migration lint |
| Every query through `scoped(executor, ctx)` | A Kysely plugin ANDs `table.tenant_id = ctx.tenantId` (and `project_id`) onto the final SELECT/UPDATE/DELETE and rejects INSERTs without the context's ids. A hand-written `WHERE` is never the isolation | `packages/db/src/scoped.ts`, `scoped.test.ts`; lint bans raw-executor queries in repositories |
| The escape hatch is typed and named | `unsafeUnscoped(executor, reason)`, reason a closed union; banned by lint in services and repositories | `docs/ENGINEERING/07` |
| Indexes lead with `tenant_id` | The isolation predicate is also the cheapest one | `docs/ENGINEERING/07` |

## Object storage

Every object key begins with `{tenant_id}/{project_id}/`
(`docs/STORAGE/04`, `SEC-TEN-05`), and the key is stored on the row that
owns it, never derived from request input (`SEC-UPL-06`). Enforced by the
`P2-01` key builder and its tests.

## Caches

Every cache key includes the tenant id: `img:v1:<tenant_id>:...`
(`docs/ENGINEERING/08`); the CDN cache key includes tenant and application
(`docs/CDN/01`, `P4-02`). No cache exists yet; each lands with its key test.

## Verification

The behavioral proof is the isolation harness
(`docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`): for every route that takes an
id, another tenant gets `404` and the owner does not.

## Acceptance Criteria

- [x] Every mechanism names its enforcement; the database and query ones
      are automated today, storage and cache ones by the tasks that build them.

## Related Documents

- `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`
- `docs/SECURITY/10-MULTI-TENANT-SECURITY.md`, `11-IDOR-BOLA-PREVENTION.md`
- `docs/DATABASE/00-DATA-MODEL.md`
