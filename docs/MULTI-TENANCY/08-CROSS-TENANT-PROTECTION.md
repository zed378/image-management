# 08 - Cross-Tenant Protection

> Category: **Multi-Tenancy** (`docs/MULTI-TENANCY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The specific attack defended against: an authenticated caller for tenant A
supplies tenant B's resource id -- in a path, a body, a query string or a
header -- and expects the platform to act on it. The platform refuses,
every time, at every layer, and the refusal reveals nothing.

## Category Mandate

The platform is consumed by many independent applications (tenants), each
with its own assets, quotas, and CDN configuration. Multi-tenancy is
treated as a fundamental, load-bearing requirement, not an afterthought: a
request scoped to Tenant A must never be able to read, modify, or enumerate
Tenant B's resources under any circumstance.

---

## Where a foreign id can appear, and the answer

| Where | Answer | Why it holds |
|---|---|---|
| Path (`/api-keys/{B's key}`) | `404 <resource>_not_found` | `scoped()` finds no row; absent and foreign are one branch |
| Path, under the caller's own parent (`/applications/{A's app}/api-keys/{B's key}`) | `404` | the child is looked up under the caller's tenant |
| Path parent (`/applications/{B's app}/...`) | `404 application_not_found` | the parent check runs under the caller's tenant |
| Body reference (`project_ids: [B's project]`) | `404 project_not_found` | referenced ids are resolved through `scoped()` before use; composite FKs refuse a stored cross-tenant link regardless |
| `tenant_id` in the body | `400 validation_failed` | request schemas are `.strict()`; `scoped()` also overwrites tenant columns on insert |
| `tenant_id` in a query string or header | ignored | the tenant comes only from the credential (`SEC-TEN-01`) |
| Another application's resource, same tenant | `404` | a credential is bound to its application and project coverage |

Never `403`: it would confirm the resource exists. A mutating request on a
foreign id changes nothing.

## Tests

- `services/api/tests/tenant-isolation.int.test.ts` -- the harness, every
  route with an id (`docs/SECURITY/11`).
- `services/api/tests/api-keys-http.int.test.ts` -- the parent/child
  variants, application confinement, the victim still working afterwards.
- `services/api/tests/authentication.test.ts` -- `tenant_id` in query and
  header ignored.
- `packages/test-utils/tests/data-model.int.test.ts` -- cross-tenant and
  cross-project links refused by the database.

## Acceptance Criteria

- [x] Every place a foreign id can appear has a stated answer and a test.

## Related Documents

- `docs/MULTI-TENANCY/04-DATA-ISOLATION.md`
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`
