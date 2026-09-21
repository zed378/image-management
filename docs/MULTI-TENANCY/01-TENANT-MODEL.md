# 01 - Tenant Model

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The tenant is the top-level isolation boundary: the billing and plan scope,
the owner of every application, and the row every other table's `tenant_id`
traces back to.

## Category Mandate

The platform is consumed by many independent tenants, each with its own
assets, quotas, and CDN configuration. A request scoped to Tenant A must never
be able to read, modify, or enumerate Tenant B's resources under any
circumstance.

---

## Entity

Table `tenants` (`docs/DATABASE/00-DATA-MODEL.md`, `01-ERD.md`): ULID `id`,
`name`, globally unique `slug`, `plan` (`free`, `pro`, `business`,
`enterprise`), `status` (`active`, `suspended`), timestamps, soft delete.

## Rules

- **Every tenant-owned row carries `tenant_id` directly**, `NOT NULL` --
  never only transitively through a join. `scoped()` (`P1-05`) filters on it
  with a plain predicate, which is both faster and harder to get wrong than a
  join.
- **Children reference `(parent_id, tenant_id)`**, so a child whose tenant
  disagrees with its parent's cannot be inserted.
- **A tenant is never hard-deleted while it owns anything** (`ON DELETE
  RESTRICT`); offboarding is a deliberate, audited process, not a cascade.
- **A suspended tenant** fails API authentication and delivery alike.
- **`tenant_id` never comes from the caller.** It is derived from the
  verified credential (`docs/ENGINEERING/13`, section 1).

## Acceptance Criteria

- [x] The entity, its columns and constraints match the migration.
- [x] The rules name their enforcement (schema constraint, `scoped()`, auth).

## Open Questions

- Plan tier names are starting values; `docs/PLAN/17-PRICING-ENTITLEMENT.md`
  may rename them, which is a migration.

## Related Documents

- `docs/DATABASE/00-DATA-MODEL.md`, `01-ERD.md`
- `docs/MULTI-TENANCY/02-APPLICATION-MODEL.md`, `03-PROJECT-MODEL.md`, `08-CROSS-TENANT-PROTECTION.md`
- `MEMORY/DECISIONS.md` (`ADR-005`)
