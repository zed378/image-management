# 02 - Users

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Human accounts that authenticate to the dashboard. Distinct from API keys
(`13-API-KEYS.md`), which authenticate machine traffic from consumer
applications. A user never authenticates the management or delivery API
with a password; they sign in to the dashboard, which is itself a client of
the API.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

## Table `users`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | `char(26)` | no | -- | PK, ULID check |
| `tenant_id` | `char(26)` | no | -- | FK `tenants(id)` `ON DELETE RESTRICT` |
| `email` | `citext` | no | -- | `UNIQUE`, length 3-320 |
| `display_name` | `text` | no | -- | length 1-200 |
| `password_hash` | `text` | yes | -- | `NULL` until the user sets a password (invitation flow) |
| `role` | `text` | no | -- | `owner`, `admin`, `developer`, `viewer` |
| `status` | `text` | no | `'active'` | `active`, `disabled` |
| `last_login_at` | `timestamptz` | yes | -- | |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` | `updated_at` by trigger |
| `deleted_at` | `timestamptz` | yes | -- | soft delete |

Indexes: `users_pkey (id)`, `users_email_key (email)`,
`users_tenant_id_idx (tenant_id)` -- serves listing a tenant's team.

## Invariants

- **One tenant per user in v1.** Email is unique globally, not per tenant,
  so sign-in by email is unambiguous. Multi-tenant membership for one human
  would move tenancy to a join table; recorded as an open question.
- **`role` is the user's tenant-wide role.** Narrower per-application or
  per-project grants live in `role_assignments` (`12-PERMISSIONS.md`).
- **`password_hash` stores an Argon2id hash**, never the password
  (`P6-09`). The column is excluded from every mapper that builds a domain or
  wire object.
- A tenant has at least one `owner` at all times; enforced by the service
  that changes roles (`P1-04`), since a CHECK cannot count rows.

## Acceptance Criteria

- [x] Column list matches `20260921T0900_create_tenancy_chain` exactly.
- [x] Case-insensitive email uniqueness verified by test.

## Open Questions

- Users belonging to more than one tenant: out of scope for v1.
- SSO (SAML/OIDC) fields: not in v1 scope.

## Related Documents

- `docs/DATABASE/01-ERD.md`, `12-PERMISSIONS.md`, `13-API-KEYS.md`
- `docs/SECURITY/03-AUTHENTICATION.md`
- `docs/UI-UX/01-INFORMATION-ARCHITECTURE.md`
