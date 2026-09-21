# 03 - Project Model

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

A project is an isolated asset space within an application. It is the
narrowest tenancy scope and the one most queries filter on.

## Category Mandate

The platform is consumed by many independent tenants. A request scoped to
Tenant A must never be able to read, modify, or enumerate Tenant B's
resources under any circumstance.

---

## Entity

Table `projects` (`docs/DATABASE/04-PROJECTS.md`): ULID `id`, `tenant_id`,
`application_id` (composite FK with `tenant_id`), `name`, `slug` unique per
application, `settings` jsonb, `status`, timestamps.

## Rules

- **Every project-owned row carries both `tenant_id` and `project_id`**, and
  references `projects (id, tenant_id)` compositely.
- **The request's project comes from the URL** (`/v1/projects/:projectId/...`)
  and is authorized against the credential's allowed projects. A project the
  credential may not access is answered with `404`, exactly as if it did not
  exist (`docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`) -- the project id is
  itself a resource id.
- **Projects are also isolation units within one tenant.** A folder, tag, or
  collection from project P1 cannot be attached to an asset in project P2
  even when both belong to the same tenant (`P2-06` tests this).
- **Settings are per project**, not per deployment: the dimension ladder
  (`ADR-014`) and strict parameters (`ADR-013`) are configured here.

## Acceptance Criteria

- [x] Entity matches the migration; rules name their enforcement.

## Related Documents

- `docs/DATABASE/04-PROJECTS.md`
- `docs/MULTI-TENANCY/01-TENANT-MODEL.md`, `02-APPLICATION-MODEL.md`, `04-DATA-ISOLATION.md`
