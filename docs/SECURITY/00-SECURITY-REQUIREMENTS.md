# 00 - Security Requirements

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The top-level index of what "secure" means for this platform. Every security
requirement has a stable ID, a MUST/SHOULD/MAY level, the document that
specifies it in full, how it is enforced (an automated test, a CI gate, or a
named manual check), and the task that implements it. `TASKS/` and test
names reference these IDs directly (`it("SEC-TEN-03: ...")`).

This document states *what*; the numbered documents in this category state
*how*. Where this index and a detail document disagree, the detail document
is wrong until one of them is changed deliberately, with a
`MEMORY/DECISIONS.md` entry.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

## Reading this table

- **Level** -- RFC 2119. A MUST that is not yet implemented is a gap tracked
  by its task, never a waiver.
- **Enforced by** -- `test` (an automated test fails if the rule is broken),
  `CI` (a pipeline step fails), `lint` (a static rule fails), or `manual`
  (a named human check; the reason it cannot be automated is stated).
- **Status** -- `Done` means the enforcing mechanism exists and runs in CI;
  otherwise the task that will make it so.

---

## 1. Tenant isolation

Detail: [`10-MULTI-TENANT-SECURITY.md`](./10-MULTI-TENANT-SECURITY.md),
[`11-IDOR-BOLA-PREVENTION.md`](./11-IDOR-BOLA-PREVENTION.md),
`docs/MULTI-TENANCY/`, ADR-005.

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-TEN-01 | MUST | The system SHALL derive the tenant of a request only from its verified credential, never from a header, query parameter, body field, or path segment. | test | Done (P1-03) |
| SEC-TEN-02 | MUST | Every query on a tenant-owned table SHALL be filtered by `tenant_id` through `scoped()`; an unscoped query is permitted only through the audited `unsafeUnscoped` escape hatch in admin/maintenance code. | lint + test | P1-05, P0-11 |
| SEC-TEN-03 | MUST | A request for a resource owned by another tenant SHALL return `404` with the same code, message and shape as a genuinely absent resource. | test (per `:id` route) | P1-06 |
| SEC-TEN-04 | MUST | Every child row SHALL reference its parent by the composite `(parent_id, tenant_id)` foreign key, so the database refuses a cross-tenant link. | test | Done (P0-06), extended P1-01 |
| SEC-TEN-05 | MUST | Every cache key and every storage object key for tenant data SHALL contain the tenant id. | test | P2-01, P4-02 |
| SEC-TEN-06 | MUST | An `INSERT` SHALL take its tenant and project from the request context and ignore any such value in the payload. | test | P1-05 |

## 2. Authentication and credentials

Detail: [`03-AUTHENTICATION.md`](./03-AUTHENTICATION.md),
[`04-API-KEY-MANAGEMENT.md`](./04-API-KEY-MANAGEMENT.md),
[`05-OAUTH2.md`](./05-OAUTH2.md), [`06-OIDC.md`](./06-OIDC.md).

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-AUTH-01 | MUST | The system SHALL store only a keyed hash of an API key secret (HMAC-SHA256 under a server-side pepper, or a slow KDF), never the secret or an unkeyed hash of it. | test | Done (P1-02) |
| SEC-AUTH-02 | MUST | An API key secret SHALL be returned exactly once, in the creation response. | test | Done (P1-02) |
| SEC-AUTH-03 | MUST | Credential comparison SHALL be constant-time (`crypto.timingSafeEqual`). | test + review | Done (P1-02) |
| SEC-AUTH-04 | MUST | "Unknown key" and "wrong secret" SHALL produce the same response (`api_key_invalid`). | test | Done (P1-02, P1-03) |
| SEC-AUTH-05 | MUST | Revoking a key SHALL take effect on the next request, including through any credential cache. | test | Done (P1-02) |
| SEC-AUTH-06 | SHOULD | Failed authentication attempts SHALL be rate limited per source, with a stricter anonymous bucket. | test | Floor done (P1-03, in-memory); P5-03 |

## 3. Authorization

Detail: [`07-AUTHORIZATION.md`](./07-AUTHORIZATION.md),
[`08-RBAC.md`](./08-RBAC.md), [`09-RESOURCE-ACCESS.md`](./09-RESOURCE-ACCESS.md).

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-AZ-01 | MUST | Every route SHALL declare the permission it requires; a route without a declaration SHALL fail to register. | test | Done (P1-03: route contract); matrix P1-04 |
| SEC-AZ-02 | MUST | Authorization SHALL be two checks: a permission gate on the action and a scoped query on the row. Neither alone is sufficient. | test | P1-04 |
| SEC-AZ-03 | MUST | Default role grants SHALL be least-privilege; no role other than owner may manage credentials or members. | test | P1-04 |

## 4. Signed URLs and private delivery

Detail: [`12-SIGNED-URL.md`](./12-SIGNED-URL.md),
`docs/IMAGE-DELIVERY-PROTOCOL/21-23`, ADR-004, ADR-006.

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-URL-01 | MUST | A signature SHALL be HMAC-SHA256 over the canonical request (method, path, sorted normalized params, expiry), using the shared `packages/transform-params` normalization. | test (vectors) | P5-02 |
| SEC-URL-02 | MUST | The signature SHALL cover every parameter that affects the response. | test | P5-02 |
| SEC-URL-03 | MUST | Expiry SHALL be checked before the signature, and bounded by `DELIVERY_SIGNED_URL_MAX_TTL_SECONDS`; clock-skew tolerance SHALL be an explicit config value. | test | P5-02 |
| SEC-URL-04 | MUST | Every SDK SHALL produce byte-identical signatures for the shared test vectors. | CI | P6-06 |
| SEC-URL-05 | MUST | Storage proxy tokens (ADR-021) SHALL be HMAC-signed, expiring, and bound to one key and one operation. | test | Done (P0-07), route P2-03 |

## 5. Upload and image processing

Detail: [`13-UPLOAD-SECURITY.md`](./13-UPLOAD-SECURITY.md),
[`14-MALICIOUS-FILE-PREVENTION.md`](./14-MALICIOUS-FILE-PREVENTION.md), ADR-007.

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-UPL-01 | MUST | An upload's type SHALL be determined from its content (magic bytes confirmed by the decoder), never from its extension or declared MIME type. | test (fixtures) | P2-02, P5-04 |
| SEC-UPL-02 | MUST | Byte size, pixel dimensions and total pixel count SHALL be bounded before full decode; `sharp` limits SHALL be set explicitly. | test (bomb fixture) | P2-02, P3-01 |
| SEC-UPL-03 | MUST | Attacker-supplied SVG SHALL NOT be rasterized in-process nor served inline from the delivery origin. | test | P2-02, P5-04 |
| SEC-UPL-04 | MUST | Metadata (EXIF/XMP/IPTC, incl. GPS) SHALL be stripped from derivatives by default, after orientation is applied. | test | P3-06 |
| SEC-UPL-05 | MUST | Decoding and encoding SHALL run in the worker under a timeout and memory ceiling. | test | P3-09 |
| SEC-UPL-06 | MUST | A client-supplied filename SHALL never become a path, an object key, or an unencoded header value. | test | P2-01 |
| SEC-UPL-07 | MUST | Any fetch of a URL on a caller's behalf SHALL pass an SSRF guard (deny private, link-local and metadata addresses, re-resolve after redirect, bounded redirects, size and time). | test | P2-04 |

## 6. Responses and delivery

Detail: `docs/API/05-ERROR-HANDLING.md`, `docs/ENGINEERING/06`, `docs/CDN/`.

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-OUT-01 | MUST | An error response SHALL NOT contain a stack trace, an internal message, a connection string, or a received input value; 5xx responses carry only the registry's generic message. | test | Done (P0-09) |
| SEC-OUT-02 | MUST | Every response SHALL carry `X-Content-Type-Options: nosniff`; a delivery response's `Content-Type` SHALL come from what was produced. | test | P4-03, P4-07 |
| SEC-OUT-03 | MUST | The public delivery origin SHALL be distinct from the dashboard's origin. | manual (deployment topology; re-checked in P7-09) | P4-01 |
| SEC-OUT-04 | MUST | An error response SHALL carry explicit `Cache-Control` so no edge caches it. | test | P4-03 |
| SEC-OUT-05 | MUST | The request id SHALL be generated by the server; a client-supplied `X-Request-Id` is never trusted as the id. | test | Done (P0-08) |

## 7. Secrets and logging

Detail: `docs/DEVOPS/04-SECRETS-MANAGEMENT.md`, `docs/OBSERVABILITY/01`,
[`17-AUDIT-LOGGING.md`](./17-AUDIT-LOGGING.md).

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-SEC-01 | MUST | No secret SHALL exist in the repository, its history, a default config value, a log line, or an error message. | CI (gitleaks, full history) + test (redaction) | Done (P0-05, P0-10) |
| SEC-SEC-02 | MUST | A process SHALL refuse to start when a required secret is missing, and SHALL never print a secret's value in the refusal. | test | Done (P0-04) |
| SEC-SEC-03 | MUST | Log output SHALL redact the paths in `packages/logger`'s redaction list (authorization, cookies, keys, secrets, tokens, passwords) and credential-bearing URL parts. | test | Done (P0-05) |
| SEC-SEC-04 | MUST | Every security-relevant action (credential create/revoke, role change, tenant settings change) SHALL write an append-only audit record. | test | P1-07 |

## 8. Abuse and denial of service

Detail: [`15-RATE-LIMITING.md`](./15-RATE-LIMITING.md),
[`16-ABUSE-PREVENTION.md`](./16-ABUSE-PREVENTION.md), ADR-013, ADR-015.

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-DOS-01 | MUST | Request bodies SHALL be bounded (1 MiB for JSON; uploads by `UPLOAD_MAX_BYTES`). | test | Done (P0-08/P0-09) |
| SEC-DOS-02 | MUST | Every tenant-facing route SHALL be rate limited per authenticated identity, with limits from the tenant's entitlement. | test | P5-03 |
| SEC-DOS-03 | MUST | The number of distinct derivatives per source SHALL be bounded, so parameter permutation cannot fill storage or the queue. | test | P3-02, P5-05 |
| SEC-DOS-04 | MUST | Expensive encodes (AVIF) SHALL never be on the synchronous request path. | test | P3-05 |

## 9. Supply chain and pipeline

Detail: this document; `docs/ENGINEERING/13` section 7; `docs/DEVOPS/02-CI-CD.md`.

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-OPS-01 | MUST | CI SHALL fail on a dependency advisory of high or critical severity (`pnpm audit --audit-level=high`); moderate and low advisories are reported and triaged in the task record. | CI (`security` job) | Done (P0-10) |
| SEC-OPS-02 | MUST | CI SHALL scan the full git history for secrets on every push (gitleaks, `.gitleaks.toml`). An allowlist entry is permitted only for a value that is public by design, and its triage is recorded. | CI (`security` job) | Done (P0-10) |
| SEC-OPS-03 | SHOULD | CI SHALL run static security analysis (CodeQL `security-and-quality`) on every change and weekly. | CI (`CodeQL` workflow) | Done (P0-10) |
| SEC-OPS-04 | MUST | CI SHALL install from the committed lockfile (`--frozen-lockfile`), and package install scripts are denied unless allow-listed in `pnpm-workspace.yaml`. | CI | Done (P0-02/P0-03) |
| SEC-OPS-05 | MUST | A new runtime dependency SHALL be justified in an ADR. | manual (review; a dependency diff is visible in the lockfile) | ongoing |
| SEC-OPS-06 | SHOULD | Container images SHALL run as a non-root user and contain only production dependencies. | review (`deploy/Dockerfile` `USER node`, `pnpm deploy --prod`) | Done (P0-02) |
| SEC-OPS-07 | MUST | The storage adapter SHALL be the only code that imports a storage provider SDK. | lint | P0-11 |

## 10. Privacy and incident response

Detail: [`18-DATA-PRIVACY.md`](./18-DATA-PRIVACY.md),
[`19-INCIDENT-RESPONSE.md`](./19-INCIDENT-RESPONSE.md).

| ID | Level | Requirement | Enforced by | Status |
|---|---|---|---|---|
| SEC-PRV-01 | MUST | Deleting a tenant SHALL delete its source objects and derivatives, and purge them from the CDN, within the retention window stated in `18-DATA-PRIVACY.md`. | test | P2-08 |
| SEC-PRV-02 | MUST | A leaked credential SHALL be revocable by the platform operator without the tenant's action. | test | P1-02 |
| SEC-IR-01 | MUST | A secret found in history SHALL be rotated before the history is cleaned (`docs/ENGINEERING/13` section 6). | manual (runbook in `19-INCIDENT-RESPONSE.md`) | P5-07 |

---

## How to add a requirement

1. Give it the next free ID in its section. IDs are never reused or
   renumbered, including after a requirement is removed (strike it through
   and link the ADR that removed it).
2. State it as a testable "SHALL" sentence and name its enforcement. If it
   can only be checked by a human, say why.
3. Link the detail document, and make that document link back here.

## Acceptance Criteria

- [x] The document states every default value explicitly -- limits are
      named config keys whose defaults live in `packages/config`, never "the
      library default".
- [x] Every rule is either testable by an automated test or explicitly
      marked as a manual/operational check with its reason.
- [x] Every detail document in this category is linked from a section
      above; each links back through `docs/SECURITY/README.md`.

## Open Questions

- SVG policy (reject vs. store-and-serve-as-attachment) is owned by
  `13-UPLOAD-SECURITY.md` and decided in `P2-02`; SEC-UPL-03 holds for both.
- Rate-limit numbers per tier depend on `docs/PLAN/17-PRICING-ENTITLEMENT.md`,
  which is not final; SEC-DOS-02 fixes the mechanism, not the numbers.

## Related Documents

- `docs/SECURITY/README.md` (category index)
- `docs/SECURITY/01-THREAT-MODEL.md` (the threats these requirements answer)
- `docs/ENGINEERING/13-SECURITY-CODING-RULES.md` (the same rules, stated for the person writing code)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `MEMORY/DECISIONS.md` (ADR-004, ADR-005, ADR-006, ADR-007, ADR-015, ADR-021)
