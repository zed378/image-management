# 08 - Role-Based Access Control

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The fixed roles, the closed permission vocabulary, and exactly which role
holds which permission. The code is `packages/tenancy/src/permissions.ts`;
the matrix below is checked against it cell by cell on every test run
(`permissions.test.ts` parses this table), so this document cannot drift
from what the platform enforces.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

---

## Principles

- **Four fixed roles** -- `owner`, `admin`, `developer`, `viewer`. No custom
  roles in v1: a role set small enough to test exhaustively is a role set
  that can be audited.
- **A closed permission vocabulary** -- `<resource>:<action>` or
  `<resource>:<scope>:<action>`, a TypeScript union. A route's
  `config.permission` and an API key's permission list accept only these
  values; anything else is a compile error or a `400`.
- **Permissions are code, not rows** (ADR-022). Only *who holds which role
  where* is data (`users.role`, `role_assignments`).
- **Owner-only actions** (`SEC-AZ-03`): managing API keys and members,
  changing tenant settings, and purging. These can take a tenant away from
  its owner or destroy data irrecoverably.

## The matrix

| Permission | owner | admin | developer | viewer |
|---|---|---|---|---|
| `asset:create` | yes | yes | yes | -- |
| `asset:read` | yes | yes | yes | yes |
| `asset:update` | yes | yes | yes | -- |
| `asset:delete` | yes | yes | yes | -- |
| `asset:restore` | yes | yes | yes | -- |
| `asset:tenant:purge` | yes | -- | -- | -- |
| `derivative:transform` | yes | yes | yes | -- |
| `signed-url:sign` | yes | yes | yes | -- |
| `folder:create` | yes | yes | yes | -- |
| `folder:read` | yes | yes | yes | yes |
| `folder:update` | yes | yes | yes | -- |
| `folder:delete` | yes | yes | yes | -- |
| `collection:create` | yes | yes | yes | -- |
| `collection:read` | yes | yes | yes | yes |
| `collection:update` | yes | yes | yes | -- |
| `collection:delete` | yes | yes | yes | -- |
| `tag:create` | yes | yes | yes | -- |
| `tag:read` | yes | yes | yes | yes |
| `tag:update` | yes | yes | yes | -- |
| `tag:delete` | yes | yes | yes | -- |
| `project:create` | yes | yes | -- | -- |
| `project:read` | yes | yes | yes | yes |
| `project:update` | yes | yes | -- | -- |
| `project:delete` | yes | yes | -- | -- |
| `application:read` | yes | yes | yes | yes |
| `application:update` | yes | yes | -- | -- |
| `api-key:create` | yes | -- | -- | -- |
| `api-key:read` | yes | yes | yes | -- |
| `api-key:update` | yes | -- | -- | -- |
| `api-key:delete` | yes | -- | -- | -- |
| `webhook:create` | yes | yes | -- | -- |
| `webhook:read` | yes | yes | yes | -- |
| `webhook:update` | yes | yes | -- | -- |
| `webhook:delete` | yes | yes | -- | -- |
| `usage:read` | yes | yes | yes | yes |
| `audit-log:read` | yes | yes | -- | -- |
| `member:read` | yes | yes | -- | -- |
| `member:update` | yes | -- | -- | -- |
| `tenant:read` | yes | yes | -- | -- |
| `tenant:update` | yes | -- | -- | -- |

## Scopes

A user has one **tenant-wide role** (`users.role`) and may be granted a
role on an **application** or on one **project** of it
(`role_assignments`; `owner` is tenant-wide only). The permissions a user
has for an action are `effectivePermissions(tenantRole, grants, scope)`:

| Grant | Applies to |
|---|---|
| tenant-wide role | everything in the tenant |
| role on application A | A, and every project of A |
| role on project P of A | P only -- not A itself, not A's other projects |

Grants only add to the tenant-wide role; nothing subtracts. (Tested
exhaustively for each scope in `permissions.test.ts`.)

**API keys** do not have roles: a key carries an explicit permission list
drawn from the same vocabulary, and a key can never be issued with more
than its issuer holds (`04-API-KEY-MANAGEMENT.md`).

## Enforcement

1. Every `/v1` route declares its permission; a route without one fails to
   register (`SEC-AZ-01`, `services/api/src/http/authentication.ts`).
2. The permission is checked in `preHandler`, before the handler:
   `403 permission_denied` when missing.
3. The permission gate is **coarse** -- "may this credential do this kind of
   thing". Whether *this row* is the caller's is `scoped()` and the service
   (`SEC-AZ-02`). Both, always.

## Adding a permission

Add it to `PERMISSIONS`, give it to the roles that should hold it in
`ROLE_PERMISSIONS`, add its row to the table above (the test fails until
you do), and write the route's deny-path test.

## Acceptance Criteria

- [x] The complete role x permission matrix is stated and matches the code
      exactly (`permissions.test.ts` parses this table).
- [x] Every role is tested against every permission, and every scope rule
      is tested.

## Related Documents

- `docs/DATABASE/12-PERMISSIONS.md` (role assignments)
- `docs/SECURITY/07-AUTHORIZATION.md`, `04-API-KEY-MANAGEMENT.md`
- `packages/tenancy/src/permissions.ts`
