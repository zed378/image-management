# 01 - Architecture Principles

> Category: **Architecture** (`docs/ARCHITECTURE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The non-negotiable architectural rules, stated once so every other document
can assume them. Each principle names how it is verified.

---

## The principles

### 1. Storage-agnostic

Consumer applications never learn which object store holds their images.
Every storage operation goes through the `StorageAdapter` interface
(`docs/STORAGE/01-STORAGE-ABSTRACTION.md`, `ADR-001`).

- **Verified by:** the adapter conformance suite runs every implementation
  through identical tests (`P0-07`); a lint rule bans provider SDK imports
  outside `packages/storage-adapter`.

### 2. Stateless request tier

`services/api` and `services/worker` keep no state between requests that
their correctness depends on. Any replica can serve any request; a replica
can be killed at any time.

- **Verified by:** the integration suite runs requests against a freshly
  built app instance per file; `P7-06` kills processes mid-burst.

### 3. Derivatives are pure functions of (asset version, canonical params)

The same asset version and the same canonical parameter set always produce
the same `params_hash`, the same object key, the same cache key, and
equivalent bytes. There is exactly one normalization function (`ADR-004`,
`ADR-009`) and deferred values resolve before hashing (`ADR-014`).

- **Verified by:** the append-only golden-vector suite in
  `packages/transform-params`; the pipeline golden-image suite (`P3-03`).

### 4. Tenant isolation at the data layer, not only the API layer

Every query on a tenant-owned table passes through `scoped()`, which
injects the tenant and project predicate by construction (`ADR-005`). The
API-layer permission check is in addition to this, never instead of it.

- **Verified by:** the cross-tenant isolation suite, a CI gate that fails
  when a `:id` route has no isolation test (`P1-06`).

### 5. Nothing slow or third-party-dependent on the request path

Webhook delivery, full-effort encoding, the AVIF size guard, and usage
aggregation run in `services/worker` through the queue (`ADR-007`). The
request path does at most the cheap synchronous encode.

- **Verified by:** code review against `docs/ENGINEERING/08`; `P3-09`'s
  saturation test shows `/healthz` stays responsive with the queue full.

### 6. One contract per concern

The management contract is `docs/API/`; the consumption contract is
`docs/IMAGE-DELIVERY-PROTOCOL/`. Where they overlap, the protocol category is
normative (`ADR-009`).

- **Verified by:** the protocol conformance suite (`P4-08`).

### 7. Fail closed

On any doubt -- an unparseable signature, a missing tenant context, an
unknown visibility value, an unreadable cache entry -- the system denies or
falls back to the authoritative source. It never guesses permissively.

- **Verified by:** negative tests for every visibility level (`P5-01`) and
  every authentication failure mode (`P1-03`).

### 8. Configuration is validated at startup

A process with invalid or missing configuration refuses to start, rather
than starting and failing on the first request (`docs/DEVOPS/03-CONFIGURATION.md`).

- **Verified by:** a config test that removes each required variable and
  asserts a startup failure (`P0-04`).

## Defaults stated explicitly

| Concern | Default | Source |
|---|---|---|
| IDs | ULID | `ADR-003` |
| Wire JSON casing | `snake_case` | `ADR-011` |
| Timestamps | RFC 3339 UTC, `Z` suffix | `docs/API/01-API-STANDARDS.md` |
| Unknown transformation params | partitioned per `ADR-013` | `IMAGE-DELIVERY-PROTOCOL/03` |
| Foreign-tenant resource | `404`, byte-identical to absent | `docs/SECURITY/11` |
| Fit mode | `scale-down` | `ADR-012` |

## Acceptance Criteria

- [x] Every principle names how it is verified, automated or operational.
- [x] Every default is stated explicitly with its source.
- [x] Cross-references are correct and point to documents that describe the
      mechanism in full.

## Open Questions

- None open at the principle level. Implementation-specific questions live
  in the documents each principle links to.

## Related Documents

- `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md`
- `docs/ENGINEERING/00-CODING-CONTEXT.md`
- `MEMORY/DECISIONS.md` (`ADR-001` .. `ADR-017`)
