# Phase 0 -- Foundation

Goal: a running skeleton with no product features yet, but every
cross-cutting concern (repo layout, config, CI, local infra, the storage
abstraction interface, and the core data model) in place so every later
phase builds on solid ground instead of retrofitting it.

Exit criteria: `docker compose up` brings up Postgres, Redis, and a local
S3-compatible store (MinIO); `pnpm test` runs a green (if empty) suite in
CI; the API Gateway responds `200` on a health check; the storage adapter
interface has one working implementation (local/MinIO).

---

### P0-01: Repository & workspace scaffolding

- **Depends on:** none
- **Implements:** `docs/ARCHITECTURE/01-ARCHITECTURE-PRINCIPLES.md`, `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md`

Set up the monorepo layout that mirrors the service boundaries: a package
per service (`api-gateway`, `asset-service`, `image-processing-service`,
`storage-service`, `search-service`), a `packages/` dir for shared code
(`schema`, `storage-adapter`, `config`, `logger`), and a workspace tool
(pnpm workspaces + Turborepo, or equivalent) that can build/test/lint the
whole tree or a single package.

**Steps**
1. Initialize the workspace tool and root `package.json`/`tsconfig.base.json`.
2. Create empty packages for each service and each shared package with a
   minimal "hello" export and a passing placeholder test.
3. Wire root-level `lint`, `typecheck`, `test`, `build` scripts that fan out
   to every package.
4. Add `.editorconfig`, `.gitignore`, `.env.example`.

**Definition of Done**
- [ ] `pnpm install && pnpm build && pnpm test` succeeds from a clean clone.
- [ ] Each service package builds independently (no accidental cross-imports
      between services -- only through `packages/`).
- [ ] `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md` updated to Final, naming
      the actual package names chosen.

---

### P0-02: Local infrastructure via Docker Compose

- **Depends on:** P0-01
- **Implements:** `docs/DEVOPS/00-ENVIRONMENT.md`, `docs/DEVOPS/01-CONTAINERIZATION.md`

**Steps**
1. Add `deploy/docker-compose.yml` with: PostgreSQL, Redis, MinIO
   (S3-compatible, for local `STORAGE/10-STORAGE-PROVIDER-ADAPTER.md` dev),
   and a mail-catcher if webhooks-to-email debugging is desired.
2. Add a `deploy/README.md` documenting `docker compose up`, default
   credentials (dev only, never reused elsewhere), and port mapping.
3. Add a root `.env.example` covering every variable the compose file and
   the services need; `.env` itself stays git-ignored.

**Definition of Done**
- [ ] A fresh clone + `docker compose up` + `pnpm dev` serves the API
      Gateway health check locally with no manual steps beyond copying
      `.env.example` to `.env`.
- [ ] `docs/DEVOPS/00-ENVIRONMENT.md` lists every environment (local, CI,
      staging, production) and what differs between them.

---

### P0-03: CI pipeline

- **Depends on:** P0-01
- **Implements:** `docs/DEVOPS/02-CI-CD.md`

**Steps**
1. Add a CI workflow: install, lint, typecheck, unit test, build -- on every
   push and PR.
2. Cache dependencies and build outputs for speed.
3. Make lint/typecheck/unit-test failures block merge; leave
   integration/E2E (added in later phases) as a separate, allowed-to-be-slower
   job.
4. Add a required-status-check branch protection note in `docs/DEVOPS/02-CI-CD.md`
   (the actual GitHub/GitLab setting is applied by a repo admin, out of band).

**Definition of Done**
- [ ] CI is green on the `P0-01` scaffold.
- [ ] `docs/DEVOPS/02-CI-CD.md` is Final and matches the workflow file's
      actual stage names.

---

### P0-04: Structured configuration & secrets loading

- **Depends on:** P0-01
- **Implements:** `docs/DEVOPS/03-CONFIGURATION.md`, `docs/DEVOPS/04-SECRETS-MANAGEMENT.md`

**Steps**
1. Build `packages/config`: a typed, validated (e.g. schema-checked)
   config loader that reads from environment variables, fails fast on a
   missing required variable, and never has a hardcoded secret fallback.
2. Document the config hierarchy: process env > `.env` (local only) > code
   defaults, and that no service reads `process.env` directly outside this
   package.
3. Note in `docs/DEVOPS/04-SECRETS-MANAGEMENT.md` that production secrets
   come from a secrets manager (name the chosen one, e.g. AWS Secrets
   Manager / Vault) injected as environment variables at deploy time, never
   committed.

**Definition of Done**
- [ ] Every service boots via `packages/config`; removing a required env var
      causes a clear startup failure, not a runtime `undefined`.

---

### P0-05: Structured logging & base observability scaffold

- **Depends on:** P0-01
- **Implements:** `docs/OBSERVABILITY/01-LOGGING.md`, `docs/OBSERVABILITY/03-DISTRIBUTED-TRACING.md`

**Steps**
1. Build `packages/logger`: structured (JSON) logging with a required
   `request_id`/`trace_id` field, log level from config, and a helper to
   bind tenant/application/project IDs onto every log line in a request's
   scope.
2. Add a trace-ID-propagation middleware in the API Gateway that generates
   or forwards a trace ID and passes it to downstream service calls.
3. Confirm no log line can ever include a raw API key, password, or signed
   URL secret -- add a lint rule or log-scrubbing helper for this.

**Definition of Done**
- [ ] A request through the (still mostly empty) API Gateway produces one
      correlated log line per service it touches, joinable by `trace_id`.
- [ ] `docs/OBSERVABILITY/01-LOGGING.md` is Final.

---

### P0-06: Core database schema -- tenancy chain

- **Depends on:** P0-02
- **Implements:** `docs/DATABASE/00-DATA-MODEL.md`, `docs/DATABASE/01-ERD.md`, `docs/DATABASE/02-USERS.md`, `docs/DATABASE/03-APPLICATIONS.md`, `docs/DATABASE/04-PROJECTS.md`, `docs/MULTI-TENANCY/01-TENANT-MODEL.md`, `docs/MULTI-TENANCY/02-APPLICATION-MODEL.md`, `docs/MULTI-TENANCY/03-PROJECT-MODEL.md`

**Steps**
1. Choose and document the primary key strategy (recommend ULIDs: sortable,
   URL-safe, no coordination needed).
2. Write the first migration: `tenants` (or `organizations`), `users`,
   `applications` (FK -> tenant), `projects` (FK -> application).
3. Set up the migration tool and confirm forward + rollback both run
   cleanly against the local Postgres from P0-02.
4. Write `docs/DATABASE/01-ERD.md` as a real diagram of what exists so far
   (this file grows with every later schema task).

**Definition of Done**
- [ ] Migrations apply cleanly from empty; rollback of the latest migration
      is tested, not just assumed to work.
- [ ] `docs/DATABASE/02-USERS.md`, `03-APPLICATIONS.md`, `04-PROJECTS.md`
      are Final and match the actual column list.

---

### P0-07: Storage abstraction interface + provider adapters

- **Depends on:** P0-02
- **Implements:** `docs/STORAGE/00-STORAGE-ARCHITECTURE.md`, `docs/STORAGE/01-STORAGE-ABSTRACTION.md`, `docs/STORAGE/10-STORAGE-PROVIDER-ADAPTER.md`

Scope widened on 2026-09-21 at the product owner's request (`ADR-021`,
superseding `ADR-002`): local disk is the default provider, and network
filesystems, object storage, and other network-reachable storage are
first-class alternatives.

**Steps**
1. Define the `StorageAdapter` interface in `packages/storage-adapter`:
   `put`, `get`, `stat`, `exists`, `delete`, `copy`, `list`, `presignPut`,
   `presignGet`, `close`, plus a declared `capabilities` object.
2. Implement adapters: `local` (default; also NFS/SMB/EFS mounts), `s3`
   (every S3-compatible store), `azure-blob`, `sftp`, `webdav`, and an
   in-memory adapter for tests.
3. Implement platform-proxied presigned URLs (`withProxyPresign`) so direct
   upload works on providers that cannot sign their own URLs.
4. Write a shared conformance suite that every adapter must pass unmodified,
   and run it against a real server for each provider in CI.

**Definition of Done**
- [x] No package outside `packages/storage-adapter` imports a storage
      provider SDK (lint rule lands in `P0-11`).
- [x] `docs/STORAGE/01-STORAGE-ABSTRACTION.md` documents the interface
      signature verbatim, kept in sync with the code.
- [x] Every adapter passes the conformance suite against a real server.

---

### P0-08: API Gateway skeleton + health check

- **Depends on:** P0-04, P0-05
- **Implements:** `docs/ARCHITECTURE/04-API-GATEWAY.md`, `docs/API/00-API-OVERVIEW.md`, `docs/API/01-API-STANDARDS.md`

**Steps**
1. Stand up the API Gateway service with a `GET /healthz` (liveness) and
   `GET /readyz` (checks DB + Redis + storage reachability) endpoint.
2. Fix the response envelope, error shape, and timestamp format per
   `docs/API/01-API-STANDARDS.md` (write that document as part of this
   task, don't leave it a stub).
3. Add the `/v1/` path-versioning prefix now, even with nothing behind it
   yet, per `docs/API/04-API-VERSIONING.md`.

**Definition of Done**
- [ ] `docs/API/00-API-OVERVIEW.md` and `01-API-STANDARDS.md` are Final.
- [ ] `/readyz` genuinely fails (non-200) when Postgres or Redis is down --
      verified by a test that stops the dependency and checks the response.

---

### P0-09: Error handling & standard error envelope

- **Depends on:** P0-08
- **Implements:** `docs/API/05-ERROR-HANDLING.md`

**Steps**
1. Define the error envelope: stable `error.code` (machine-readable, e.g.
   `asset_not_found`), `error.message` (human-readable, safe to show a
   developer), `error.request_id`.
2. Map every framework-level exception (validation, 404, 500) through this
   envelope; never leak a raw stack trace or internal exception message to
   a client response.
3. Build the shared error classes in `packages/schema` (or a dedicated
   `packages/errors`) so every service raises the same shapes.

**Definition of Done**
- [ ] `docs/API/05-ERROR-HANDLING.md` is Final with the full `error.code`
      taxonomy used by v1 (extended by later phases, never redefined).

---

### P0-10: Base CI security scan + dependency audit

- **Depends on:** P0-03
- **Implements:** `docs/SECURITY/00-SECURITY-REQUIREMENTS.md`

**Steps**
1. Add a dependency vulnerability scan (e.g. `pnpm audit` / equivalent) and
   a basic static analysis/secret-scan step to CI, non-blocking initially
   with a tracked follow-up to make it blocking once the baseline is clean.
2. Write `docs/SECURITY/00-SECURITY-REQUIREMENTS.md` as the top-level index
   of every SECURITY/ document, so it's clear from day one what "secure"
   means for this platform, not just assumed.

**Definition of Done**
- [ ] CI security scan step exists and its current findings (if any) are
      triaged in `MEMORY/records/P0-10.md`, not silently ignored.

---

### P0-11: Enforce the engineering conventions in tooling

- **Depends on:** P0-01, P0-03
- **Implements:** `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md`, `docs/ENGINEERING/02-PROJECT-STRUCTURE.md`

`docs/ENGINEERING/` states the conventions; this task makes the ones that
can be machine-checked machine-checked, so ADR-001, ADR-004, and ADR-005
survive sessions that never read the documents. A convention only a
reviewer enforces is a suggestion.

**Steps**
1. Flat ESLint config at the root with the architectural
   `no-restricted-imports` / `no-restricted-syntax` rules from
   `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md`: controller -> repository,
   service -> HTTP types, provider SDKs outside `packages/storage-adapter`,
   param hashing outside `packages/transform-params`, `console.*`, and
   `unsafeUnscoped` outside admin/maintenance contexts. Each rule carries a
   message naming the ADR or document it enforces.
2. The correctness rule set (`no-explicit-any`, `no-floating-promises`,
   `no-misused-promises`, `switch-exhaustiveness-check`,
   `consistent-type-imports`, `import/no-default-export`, `import/order`),
   all as errors, with `--max-warnings=0`.
3. `dependency-cruiser` config with the forbidden rules: no cycles, no
   `services/* -> services/*`, no `packages/* -> services/*`, no
   `apps/* -> ` internals, no deep package imports. Wire `pnpm deps:check`.
4. Prettier + `.editorconfig` + `.gitattributes` (`eol=lf`), and
   `lint-staged` on pre-commit; `commit-msg` hook validating the
   `P{phase}-{seq}: <summary>` subject from `TASKS/00-TASK-CONVENTIONS.md`.
5. Add every step to CI in the fail-fast order
   `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md` specifies, and wire the
   coverage thresholds from `docs/ENGINEERING/09-TESTING-CONVENTIONS.md`.

**Definition of Done**
- [ ] A deliberately-violating fixture commit fails the build for each
      architectural rule -- the rules are proven to fire, not just present.
- [ ] `pnpm lint typecheck test deps:check` all run identically locally and
      in CI, with zero warnings tolerated.
- [ ] `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md` updated with the
      framework/ORM-specific rule targets left open by `P0-06` and `P0-08`,
      or an explicit note that they are still pending.

---
