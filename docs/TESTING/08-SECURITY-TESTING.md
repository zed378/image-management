# 08 - Security Testing

> Category: **Testing** (`docs/TESTING/`) &nbsp;|&nbsp; Status: Final (v1 -- grows with each security task) &nbsp;|&nbsp; Owner: TBD

## Purpose

Which security properties are tested automatically, by which suite, and
which CI job runs it. A security control without a test that fails when it
breaks is a control nobody will notice losing.

## Category Mandate

The test strategy across every layer of the platform -- unit, integration,
API contract, transformation correctness, security, performance,
failure-injection, and end-to-end -- with explicit ownership of what each
layer is responsible for catching.

---

## Suites

| Property | Suite | CI job |
|---|---|---|
| **Every route that takes an id has an isolation case** (route table introspected) | `services/api/tests/isolation-gate.test.ts` | `verify` (unit) |
| **Another tenant gets 404, the owner does not, for every such route** | `services/api/tests/tenant-isolation.int.test.ts` + `tests/isolation/cases.ts` | `integration` |
| Tenant predicate compiled into every scoped statement; cannot be removed | `packages/db/src/scoped.test.ts` | `verify` |
| Cross-tenant/cross-project links refused by the schema; migration lint | `packages/test-utils/tests/data-model.int.test.ts` | `integration` |
| Repositories cannot bypass `scoped()`; SDKs, hashing, logging rules | `tools/tests/lint-rules.test.ts` | `verify` |
| Authentication by default, 401 vs 403, store outage = 503, failure limiting | `services/api/tests/authentication.test.ts` | `verify` |
| Key secrecy, revocation, rotation, escalation refusal | `api-keys.int.test.ts`, `api-keys-http.int.test.ts` | `integration` |
| Role x permission matrix equals `docs/SECURITY/08` | `packages/tenancy/src/permissions.test.ts` | `verify` |
| No internals or input echoed in errors | `services/api/tests/error-handling.test.ts` | `verify` |
| Redaction of secrets in logs | `packages/logger/src/redact.test.ts` | `verify` |
| Dependency advisories, secrets in history, static analysis | `security` job, CodeQL workflow (`docs/SECURITY/00` SEC-OPS) | `security`, `CodeQL` |

## The IDOR/BOLA gate (P1-06)

`isolation-gate.test.ts` builds the real application with a route observer
(`buildApp({ onRoute })`), collects every `/v1` route whose path has a
parameter (`HEAD` excluded, it mirrors `GET`), and fails if any lacks a
case in `ISOLATION_CASES` -- and if any case names a route that no longer
exists. A test registers a new `GET /v1/assets/:asset_id` without a case
and asserts the gate reports it, so the gate is proven to fire. Adding an
id route without an isolation test therefore fails CI by construction.

## Adding a security-relevant feature

1. Name the requirement id in `docs/SECURITY/00`.
2. Add the test to the suite above that matches, or a new row here.
3. A route that takes an id: a case in `ISOLATION_CASES` (the gate
   insists).

## Acceptance Criteria

- [x] Every automated security property names its suite and CI job.
- [x] The route gate is proven to fire on an uncovered route.

## Related Documents

- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`, `00-SECURITY-REQUIREMENTS.md`
- `docs/DEVOPS/02-CI-CD.md`
