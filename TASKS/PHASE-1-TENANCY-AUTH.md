# Phase 1 -- Multi-Tenancy, Data Model & Authentication

Goal: every remaining table the platform needs, a working API-key
authentication scheme, RBAC, and -- critically -- tenant isolation proven by
automated tests before a single asset-facing feature is built on top of it.
Isolation retrofitted after features exist is far more expensive than
isolation built in from the first query.

Exit criteria: an API key can authenticate a request; the request is scoped
to exactly one project/application/tenant; an automated test suite proves
that no combination of valid key + foreign resource ID ever returns another
tenant's data.

---

### P1-01: Full data model migrations

- **Depends on:** P0-06
- **Implements:** `docs/DATABASE/05-ASSETS.md` .. `18-DATA-RETENTION.md` (all remaining DATABASE/ docs), `docs/DATABASE/01-ERD.md`

**Steps**
1. Write migrations for: `assets`, `asset_versions`, `asset_metadata`,
   `image_derivatives`, `folders`, `collections`, `collection_assets`
   (join), `tags`, `asset_tags` (join), `permissions`, `api_keys`, `usage`,
   `quotas`, `webhooks`, `webhook_deliveries`, `audit_logs`.
2. Every tenant-scoped table gets a `tenant_id` (or transitively
   `project_id` -> `application_id` -> `tenant_id`) column, `NOT NULL`, indexed.
3. Add the indexes the known query patterns need: assets by
   `(project_id, folder_id)`, assets by `(project_id, created_at)` for
   pagination, tags by `(project_id, tag)`, api_keys by `hashed_key`
   (unique).
4. Update `docs/DATABASE/01-ERD.md` with the complete diagram.

**Definition of Done**
- [ ] Every DATABASE/ document listed above is Final and matches the schema
      exactly (column names, types, constraints).
- [ ] A migration-lint check confirms every new table has a `tenant_id`-
      traceable column or is explicitly documented as global (e.g. a
      platform-level `plans` table).

---

### P1-02: API key issuance & hashed storage

- **Depends on:** P1-01
- **Implements:** `docs/SECURITY/04-API-KEY-MANAGEMENT.md`, `docs/DATABASE/13-API-KEYS.md`, `docs/API/02-AUTHENTICATION.md`

**Steps**
1. `POST /v1/admin/applications/:id/api-keys` (or dashboard-only for now):
   generates a key, returns the plaintext exactly once, stores only a salted
   hash (e.g. Argon2/bcrypt over a high-entropy secret).
2. Support key scoping (which project(s), which permission set) at
   creation time.
3. Support rotation (issue new, old remains valid for a configurable
   overlap window) and immediate revocation.
4. Store `last_used_at` (updated async, not synchronously on every request,
   to avoid a write on the hot path) for key hygiene visibility.

**Definition of Done**
- [ ] No code path can retrieve a plaintext key after creation -- verified
      by a test that inspects the DB row directly.
- [ ] Revoked key immediately fails authentication (tested, not assumed).

---

### P1-03: Authentication middleware

- **Depends on:** P1-02
- **Implements:** `docs/API/02-AUTHENTICATION.md`, `docs/SECURITY/03-AUTHENTICATION.md`, `docs/ARCHITECTURE/05-AUTHENTICATION-SERVICE.md`

**Steps**
1. Middleware at the API Gateway: extract bearer token, look up hashed key,
   attach `{ tenant_id, application_id, project_ids[], permissions[] }` to
   the request context.
2. Reject with `401` (not authenticated) vs. `403` (authenticated, not
   authorized) distinctly and consistently -- fix this distinction now
   since it is easy to blur later.
3. Add rate limiting on the auth endpoint itself to blunt credential
   stuffing (ties into `docs/SECURITY/15-RATE-LIMITING.md`, fully built in
   Phase 5).

**Definition of Done**
- [ ] Every route registered after this task requires this middleware by
      default (opt-out, not opt-in, for any future public route).

---

### P1-04: RBAC roles & permission checks

- **Depends on:** P1-03
- **Implements:** `docs/SECURITY/08-RBAC.md`, `docs/DATABASE/12-PERMISSIONS.md`

**Steps**
1. Define the fixed role set (Owner, Admin, Developer, Viewer) and the
   allow-listed actions per role, per scope (application or project).
2. Build an authorization guard/decorator usable on any route:
   `@RequirePermission('asset:delete')`.
3. Unit test every role against every defined action -- this table is small
   enough to test exhaustively, so do it exhaustively.

**Definition of Done**
- [ ] `docs/SECURITY/08-RBAC.md` is Final with the complete role x action
      matrix, matching the test table exactly.

---

### P1-05: Tenant isolation enforcement at the query layer

- **Depends on:** P1-04
- **Implements:** `docs/MULTI-TENANCY/04-DATA-ISOLATION.md`, `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`, `docs/SECURITY/10-MULTI-TENANT-SECURITY.md`

**Steps**
1. Build a query-layer helper/base-repository that *always* injects the
   authenticated request's `tenant_id`/`project_id` into every read/write --
   make it structurally difficult to write a query that skips this (e.g. a
   base repository class every other repository must extend, code-reviewed
   for any raw-query bypass).
2. Write the isolation test harness: two fully-seeded tenants (A and B),
   and a test utility that, for any given resource type, asserts a Tenant-A
   key requesting a Tenant-B resource ID gets `404`.
3. Run this harness against every existing endpoint (there are few this
   early -- keep it that way by running the harness in CI on every future
   endpoint too).

**Definition of Done**
- [ ] The isolation test harness exists as a reusable CI-gated test suite,
      not a one-off script.
- [ ] `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md` is Final and names this
      harness as the enforcement mechanism.

---

### P1-06: IDOR/BOLA test suite as a CI gate

- **Depends on:** P1-05
- **Implements:** `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`, `docs/TESTING/08-SECURITY-TESTING.md`

**Steps**
1. Promote the P1-05 harness into a CI job that runs automatically against
   every `:id`-scoped route registered in the router (introspect the route
   table rather than hand-maintaining a list, so a new endpoint can't be
   forgotten).
2. Fail CI if any route lacks a corresponding isolation test.

**Definition of Done**
- [ ] Adding a new `:id` route with no isolation test fails CI by
      construction, not by someone remembering to check.

---

### P1-07: Audit logging

- **Depends on:** P1-04
- **Implements:** `docs/DATABASE/17-AUDIT-LOGS.md`, `docs/SECURITY/17-AUDIT-LOGGING.md`

**Steps**
1. Append-only `audit_logs` writes on: API key created/revoked/rotated,
   role/permission changes, asset visibility changes, asset hard-deletion,
   admin overrides.
2. Guarantee the write path cannot be bypassed by writing it into the same
   base repository/service layer used everywhere else, not as an
   after-the-fact addition per endpoint.

**Definition of Done**
- [ ] Audit log rows are provably immutable (no `UPDATE`/`DELETE` grant on
      the table for the application's DB role).

---

### P1-08: Quota & usage tables wired (metering scaffold, no enforcement yet)

- **Depends on:** P1-01
- **Implements:** `docs/DATABASE/14-USAGE.md`, `docs/DATABASE/15-QUOTAS.md`, `docs/PLAN/15-QUOTA-LIMITS.md`

**Steps**
1. Define the `quotas` table (per plan tier, per metric) and the `usage`
   table (time-bucketed counters per project).
2. Build the async usage-aggregator worker skeleton (reads events off a
   queue, rolls them into `usage`) -- actual events are wired in later
   phases as upload/transformation/bandwidth features land.
3. Do not enforce quotas yet (no feature produces usage yet); this task
   only makes the metering substrate exist so later phases plug into it
   instead of retrofitting it.

**Definition of Done**
- [ ] `docs/PLAN/15-QUOTA-LIMITS.md` is Final, defining every metric, its
      scope, and its over-limit behavior even though enforcement lands later.

---
