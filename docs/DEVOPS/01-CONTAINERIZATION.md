# 01 - Containerization

> Category: **DevOps** (`docs/DEVOPS/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How the platform's deployables and its local dependencies are packaged as
containers.

## Category Mandate

Environments, containerization, CI/CD, configuration and secrets management,
migrations, backup/restore, and disaster recovery.

---

## Service images

One Dockerfile, `deploy/Dockerfile`, builds either deployable
(`ADR-017`):

```bash
docker build -f deploy/Dockerfile --build-arg SERVICE=api    -t image-delivery-api .
docker build -f deploy/Dockerfile --build-arg SERVICE=worker -t image-delivery-worker .
```

Two stages:

1. **build** -- `node:24-bookworm-slim`. Installs the workspace from the
   frozen lockfile, bundles the service with `tsup` (workspace packages are
   inlined; third-party packages stay external, `ADR-018`), then
   `pnpm deploy --prod` produces a standalone production `node_modules` for
   that one service. Native modules (`sharp` and its libvips, `ssh2`) are
   resolved for the image's platform here, not copied from the developer's
   machine.

   Because the bundle imports third-party packages by name, each must be a
   **direct** dependency of the service; `pnpm build` runs
   `scripts/check-bundle-deps.mjs`, which fails the build when the bundle
   imports an undeclared package (the ADR-018 addendum in `ADR-020`).
2. **runtime** -- `node:24-bookworm-slim`, the bundle plus production
   dependencies only. Runs as the unprivileged `node` user.

### Rules

- **Build once, promote everywhere.** CI builds an image per commit; the
  same digest runs in staging and then production. Nothing
  environment-specific is baked in -- every difference is configuration
  (`03-CONFIGURATION.md`).
- **glibc base, not Alpine.** `sharp` ships prebuilt libvips binaries for
  glibc; on musl it falls back to a slower path or a source build. The
  image processing engine is the platform's core, so the base follows it.
- **Non-root.** `USER node`. The runtime stage contains no compiler, no
  package manager cache, and no source beyond the bundle's sourcemap.
- **No `HEALTHCHECK` instruction.** Orchestrators probe `/healthz` and
  `/readyz` directly (`docs/ARCHITECTURE/04-API-GATEWAY.md`); a Docker-level
  healthcheck would duplicate that with a less precise signal.
- **Source maps on.** `--enable-source-maps` so production stack traces in
  logs point at TypeScript source lines.

## Local dependency containers

`deploy/docker-compose.yml` runs PostgreSQL 17, Redis 7.4, and MinIO for
local development, and `deploy/README.md` documents them. Two decisions
worth knowing:

- **Redis runs with AOF persistence and `noeviction`.** The queue lives in
  Redis; eviction or a restart that drops keys would silently lose pending
  derivative and webhook jobs (`ADR-007`).
- **MinIO is pulled from quay.io, pinned.** The `minio/minio` repository on
  Docker Hub no longer exists (verified 2026-09-21). Because the platform
  only speaks S3 through `packages/storage-adapter`, swapping MinIO for
  another S3-compatible server is a change to one compose service.

## Verification

- `docker build -f deploy/Dockerfile --build-arg SERVICE=api .` builds; the
  container, run in production mode against PostgreSQL and Redis, reports
  `/readyz` ready and shuts down cleanly on `SIGTERM` (verified 2026-09-21 in
  `P0-08`).
- `pnpm infra:up` brings all three dependencies to healthy and creates the
  development bucket.

## Acceptance Criteria

- [x] Both deployables build from one Dockerfile, as non-root, with no
      environment-specific content.
- [x] The base-image choice is justified by the image engine's needs.
- [x] Local dependency containers are pinned and documented.

## Open Questions

- Image signing and SBOM generation belong with the release pipeline and are
  not in the v1 task plan; `P0-10` covers dependency and secret scanning.
- Multi-architecture images (arm64 for Graviton/Ampere, which
  `docs/PERFORMANCE/02` notes as a likely price/performance win) are a
  build-matrix addition in CI when a target platform is chosen.

## Related Documents

- `deploy/Dockerfile`, `deploy/docker-compose.yml`, `deploy/README.md`
- `docs/DEVOPS/00-ENVIRONMENT.md`, `02-CI-CD.md`, `03-CONFIGURATION.md`
- `MEMORY/DECISIONS.md` (`ADR-002`, `ADR-007`, `ADR-017`, `ADR-018`)
