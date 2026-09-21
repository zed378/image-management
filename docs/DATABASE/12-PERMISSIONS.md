# 12 - Permissions (role assignments)

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Where a principal's roles are stored. The permission model has three
parts, only two of which are data:

1. **A user's tenant-wide role** -- `users.role` (`owner`, `admin`,
   `developer`, `viewer`; [`02-USERS.md`](./02-USERS.md)).
2. **Narrower grants** -- a role on one application, or on one project of
   it: rows in `role_assignments` (this document).
3. **What each role may do** -- the role -> permission matrix, which is
   **code**, not rows (`P1-04`, `docs/SECURITY/08`): permission names are a
   closed vocabulary checked at compile time, never free-form strings in a
   table (ADR-022 point 1).

API keys carry their own explicit permission list ([`13`](./13-API-KEYS.md)).

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:role_assignments -->
Table `role_assignments` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `user_id` | `character(26)` | no |  |
| `role` | `text` | no |  |
| `application_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `role_assignments_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `role_assignments_role_check`: `CHECK ((role = ANY (ARRAY['admin'::text, 'developer'::text, 'viewer'::text])))`
- `role_assignments_application_fk`: `FOREIGN KEY (application_id, tenant_id) REFERENCES applications(id, tenant_id) ON DELETE CASCADE`
- `role_assignments_project_fk`: `FOREIGN KEY (project_id, application_id, tenant_id) REFERENCES projects(id, application_id, tenant_id) ON DELETE CASCADE`
- `role_assignments_user_fk`: `FOREIGN KEY (user_id, tenant_id) REFERENCES users(id, tenant_id) ON DELETE CASCADE`
- `role_assignments_pkey`: `PRIMARY KEY (id)`
- `role_assignments_scope_uk`: `UNIQUE NULLS NOT DISTINCT (user_id, application_id, project_id)`

Indexes:

- `role_assignments_application_idx`: `(application_id, tenant_id)`
- `role_assignments_project_idx`: `(project_id) WHERE (project_id IS NOT NULL)`
- `role_assignments_user_idx`: `(tenant_id, user_id)`
<!-- /schema:role_assignments -->

## Rules

| Rule | Value | Enforced by |
|---|---|---|
| Roles grantable here | `admin`, `developer`, `viewer`; `owner` is tenant-wide only | database |
| Scope | `project_id is null`: the whole application; otherwise that project, which must belong to that application | database (`role_assignments_project_fk` over `(project_id, application_id, tenant_id)`) |
| One grant per user per scope | `unique nulls not distinct (user_id, application_id, project_id)` | database |
| Effective permissions | the union of the tenant-wide role's and every applicable grant's | service (`P1-04`) |
| At least one `owner` per tenant | | service (`docs/DATABASE/02`) |
| Change is audited and invalidates the permission cache | `role.granted` / `role.revoked` | service (`P1-07`, `docs/ENGINEERING/08`) |

Grants are hard-deleted when revoked; the audit log keeps the history.

## Acceptance Criteria

- [x] The column table is generated from the migrated schema and checked on
      every CI run.
- [x] The one-grant-per-scope rule (including the application scope, where
      `project_id` is null) is tested.

## Related Documents

- `docs/DATABASE/02-USERS.md`, `13-API-KEYS.md`
- `docs/SECURITY/07-AUTHORIZATION.md`, `08-RBAC.md`
- `MEMORY/DECISIONS.md` (`ADR-022` point 1)
