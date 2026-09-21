# 10 - Multi-Tenant Security

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The security view of multi-tenancy: what a tenant boundary guarantees, the
threats against it, and where each guarantee is enforced. The mechanisms
are detailed in `docs/MULTI-TENANCY/04` and `08`; the per-route proof in
[`11-IDOR-BOLA-PREVENTION.md`](./11-IDOR-BOLA-PREVENTION.md).

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

---

## Guarantees

1. **Confidentiality** -- no request authenticated as tenant A reads,
   lists, or learns the existence of tenant B's data (`SEC-TEN-01`, `03`).
2. **Integrity** -- no request as A modifies or deletes B's data, and no
   stored row links A's data to B's (`SEC-TEN-04`, `06`).
3. **Isolation of derived stores** -- object keys and cache keys carry the
   tenant id (`SEC-TEN-05`).
4. **Least privilege inside a tenant** -- a credential reaches only its
   application's resources and its covered projects, with its permissions
   (`SEC-AZ-*`).

## Threats and controls

| Threat | Control |
|---|---|
| Foreign id in a request (IDOR/BOLA) | `scoped()` + the 404 rule + the isolation harness (`11`) |
| A new query that forgets the tenant filter | `scoped()` is the only door; lint bans the raw executor in repositories |
| Tenant id supplied by the caller | context from the credential only; strict schemas; insert stamping |
| A cross-tenant link written by a bug | composite foreign keys |
| Privilege escalation through credentials | a key issues or rotates only within its own grant (`04`) |
| Shared cache or object key | tenant id in every key (`P2-01`, `P4-02`) |
| Operator access | `unsafeUnscoped` with a typed reason; admin actions audited under the affected tenant (`P1-07`) |

## Out of scope for v1

Physical isolation (a database or bucket per tenant). Logical isolation
with the controls above is the v1 model; Postgres row-level security
remains a candidate for defence in depth (ADR-005), in addition to
`scoped()`, never instead of it.

## Acceptance Criteria

- [x] Each guarantee and threat maps to a control with an automated test or
      a named later task.

## Related Documents

- `docs/MULTI-TENANCY/04-DATA-ISOLATION.md`, `08-CROSS-TENANT-PROTECTION.md`
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`, `00-SECURITY-REQUIREMENTS.md`
