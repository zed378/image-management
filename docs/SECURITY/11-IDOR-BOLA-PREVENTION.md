# 11 - IDOR / BOLA Prevention

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Insecure direct object reference / broken object-level authorization is the
failure where a caller names an object that is not theirs and the platform
serves it. On a multi-tenant platform it is the most damaging bug class
there is. This document states the rule and names the mechanisms that
enforce it -- each one automated.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

---

## The rule (SEC-TEN-03)

A request for an object owned by another tenant -- or outside the
credential's application or project coverage -- is answered exactly like a
request for an object that does not exist: **`404`, the same `*_not_found`
code, the same message, the same shape**. Never `403`: a `403` confirms the
object exists, which is itself a leak. And it changes nothing: a mutating
request on a foreign object has no effect.

## Enforcement, in depth

| Layer | Mechanism | Enforced by |
|---|---|---|
| Schema | Composite foreign keys over `(id, tenant_id)` and `(id, project_id, tenant_id)`: a cross-tenant or cross-project link cannot be stored | constraints; migration lint (`data-model.int.test.ts`) |
| Query | `scoped()` ANDs the tenant (and project) predicate onto the final statement; cannot be removed downstream | `packages/db/src/scoped.ts`; `scoped.test.ts` |
| Code shape | Repositories may not call `selectFrom`/`updateTable`/`deleteFrom`/`insertInto` on the raw executor, nor import `unsafeUnscoped` | ESLint (`eslint.config.js`), proven by `tools/tests/lint-rules.test.ts` |
| Context | The tenant comes from the verified credential only (`SEC-TEN-01`) | `http/authentication.ts`; `authentication.test.ts` |
| Service | "Not found" and "not yours" are one branch: a repository returns `null` for both, and the service throws the resource's `*_not_found` | code review of the pattern; covered by the harness below |
| **Behavior** | **The isolation harness**: for every route that addresses a resource by id, tenant B's key (holding every permission) gets `404` for tenant A's resource, and A's own key does not | `services/api/tests/tenant-isolation.int.test.ts` (P1-05); every `:id` route must have a case (P1-06 gate) |

## The isolation harness

`services/api/tests/isolation/`:

- `harness.ts` -- `createTenantFixture` seeds a tenant with an application,
  a project and an all-permission key; `runIsolationCase` creates the
  resource in tenant A, calls the route with B's key, then with A's key.
- `cases.ts` -- `ISOLATION_CASES`, one entry per route that takes a path
  parameter: the route exactly as registered, and how to create its
  resource. The owner call is what keeps a case honest -- a route that
  404s for everyone would otherwise pass while proving nothing.

The attacker's key holds **every** permission and covers every project of
its application, so a `404` can only come from isolation, never from a
missing permission.

## Adding a route

A new route that takes an id needs a case in `ISOLATION_CASES` in the same
change. `P1-06` makes this a CI failure: the route table is introspected,
and any route with a path parameter and no case fails the build.

## Acceptance Criteria

- [x] The rule, and each layer that enforces it, is named with its test.
- [x] The harness is a reusable, CI-run suite (runs in the `integration`
      job), not a one-off script.

## Related Documents

- `docs/SECURITY/10-MULTI-TENANT-SECURITY.md`, `00-SECURITY-REQUIREMENTS.md` (`SEC-TEN-*`)
- `docs/MULTI-TENANCY/04-DATA-ISOLATION.md`, `08-CROSS-TENANT-PROTECTION.md`
- `docs/ENGINEERING/07-REPOSITORY-DATABASE-STANDARDS.md`
- `MEMORY/DECISIONS.md` (`ADR-005`, `ADR-022`)
