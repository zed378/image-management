# 00 - Environments

> Category: **DevOps** (`docs/DEVOPS/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Every environment the platform runs in, what differs between them, and what
must never differ.

## Category Mandate

Environments, containerization, CI/CD, configuration and secrets management,
migrations, backup/restore, and disaster recovery -- the operational
machinery that keeps the platform deployable and recoverable.

---

## The four environments

| | local | test (CI + integration) | staging | production |
|---|---|---|---|---|
| Purpose | Development | Automated verification | Release rehearsal | Customers |
| Started by | `pnpm infra:up` | Testcontainers, per test run | Deploy pipeline | Deploy pipeline |
| PostgreSQL | compose, `:55432` | throwaway container | managed instance | managed instance, HA |
| Redis | compose, `:56379` | throwaway container | managed instance | managed instance, persistence on |
| Object storage | MinIO, `:59000` | throwaway MinIO | S3 or R2 bucket, `-staging` | S3 or R2 bucket, `-production` |
| CDN | none (direct to api) | none | CDN, staging zone | CDN, production zone |
| Secrets | `.env` from `.env.example` | constants in test setup | secrets manager | secrets manager |
| Data | disposable | disposable, per run | synthetic only | real |
| `NODE_ENV` | `development` | `test` | `production` | `production` |
| `LOG_LEVEL` | `debug` | `warn` | `info` | `info` |

## What must never differ

- **The container image.** Staging and production run the byte-identical
  image built once by CI (`01-CONTAINERIZATION.md`). Nothing
  environment-specific is baked in; everything varies through configuration.
- **The migration set.** Every environment runs the same migrations in the
  same order (`05-DATABASE-MIGRATION.md`).
- **The storage code path.** Local MinIO, test MinIO, and production S3/R2
  all go through the same S3-compatible adapter (`ADR-002`). This is the
  property that makes "works locally, breaks in prod" storage bugs rare.
- **Security controls.** No environment disables tenant scoping, signature
  verification, or content validation "for convenience". A control that is
  off in any environment is untested in that environment.

## What differs, deliberately

- **Scale:** replica counts, pool sizes, worker concurrency -- configuration,
  never code (`03-CONFIGURATION.md`).
- **Log level:** `debug` locally, `info` in shared environments. `debug` may
  carry normalized parameters and payloads (`docs/ENGINEERING/12`).
- **Data:** staging holds synthetic data only. Production data is never
  copied down; a bug that needs production data to reproduce is reproduced
  with a synthetic equivalent.

## Local environment

`deploy/docker-compose.yml`, documented in `deploy/README.md`:

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm dev
```

Host ports are in the `5xxxx` range so the stack never collides with a
PostgreSQL or Redis the developer already runs.

## Test environment

`pnpm test:integration` starts its own PostgreSQL, Redis, and MinIO through
Testcontainers in `packages/test-utils/src/global-setup.ts`, shared across
the run and destroyed afterwards. Tests never touch the developer's local
data, and CI needs no pre-started services -- only a Docker daemon.

## Acceptance Criteria

- [x] Every environment is listed with what differs, and what must not.
- [x] The local stack starts with one command and is verified healthy
      (`pnpm infra:up` exits 0 with all three services healthy and the bucket
      created).
- [x] The integration test environment is self-contained and verified by
      `packages/test-utils/tests/infrastructure.int.test.ts`.

## Open Questions

- Staging and production hosting (managed Postgres, Redis, and the
  orchestrator) are not provisioned by this repository yet; that is
  deployment work outside the v1 task plan, and the table above states the
  shape they must take.
- The CDN is chosen in `P4-01`.

## Related Documents

- `deploy/README.md`, `deploy/docker-compose.yml`
- `docs/DEVOPS/01-CONTAINERIZATION.md`, `03-CONFIGURATION.md`, `04-SECRETS-MANAGEMENT.md`
- `docs/ENGINEERING/09-TESTING-CONVENTIONS.md`
