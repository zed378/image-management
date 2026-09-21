# 02 - Application Model

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

An application is a tenant's product that consumes the platform. It is the
unit that holds credentials: API keys (`P1-02`) and signed-URL secrets
(`P5-02`) are issued per application.

## Category Mandate

The platform is consumed by many independent tenants. A request scoped to
Tenant A must never be able to read, modify, or enumerate Tenant B's
resources under any circumstance.

---

## Entity

Table `applications` (`docs/DATABASE/03-APPLICATIONS.md`): ULID `id`,
`tenant_id`, `name`, `slug` unique per tenant, `status`, timestamps.

## Rules

- **An API key belongs to exactly one application** and may be scoped to
  some or all of that application's projects -- never to another
  application's project, even within the same tenant.
- **`(id, tenant_id)` is unique** so that projects and every other
  application-owned table can reference it with a composite foreign key.
- **Suspending an application** revokes its API access but not public
  delivery of its projects' assets.

## Acceptance Criteria

- [x] Entity matches the migration; rules name their enforcement.

## Related Documents

- `docs/DATABASE/03-APPLICATIONS.md`, `13-API-KEYS.md`
- `docs/MULTI-TENANCY/01-TENANT-MODEL.md`, `03-PROJECT-MODEL.md`
