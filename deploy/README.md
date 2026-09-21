# deploy/

Local infrastructure and, later, per-environment deployment manifests.

## Local development

```bash
cp .env.example .env
pnpm install
pnpm infra:up          # waits for postgres/redis/minio healthy, then creates the bucket
pnpm db:migrate        # once P0-06 lands
pnpm dev
```

`pnpm infra:down` stops the stack; add `-v` to the compose command to also
delete the volumes.

## What runs

| Service | Image | Host port | Purpose |
|---|---|---|---|
| PostgreSQL | `postgres:17-alpine` | `55432` | Metadata (`docs/DATABASE/`) |
| Redis | `redis:7.4-alpine` | `56379` | Queue (BullMQ) and application cache |
| MinIO | `quay.io/minio/minio` (pinned release) | `59000` (S3), `59001` (console) | S3-compatible object storage (`ADR-002`) |
| minio-init | `quay.io/minio/mc` (pinned release) | -- | Creates the `image-delivery-dev` bucket, then exits. Run by `pnpm infra:up` as a separate step, because `compose up --wait` treats any exited container -- even exit 0 -- as a failure |

Host ports are deliberately in the `5xxxx` range so this stack does not
collide with a PostgreSQL or Redis the developer already runs locally.

## Credentials

| Service | User | Password |
|---|---|---|
| PostgreSQL | `image_delivery` | `image_delivery_dev` |
| MinIO | `image_delivery` | `image_delivery_dev` |

**Local development only.** These values appear in this repository and are
therefore public. They must never be reused in any shared, staging, or
production environment; those receive credentials from the secrets manager
at deploy time (`docs/DEVOPS/04-SECRETS-MANAGEMENT.md`).

## Integration tests do not use this stack

`pnpm test:integration` starts its own throwaway containers through
Testcontainers (`packages/test-utils/src/global-setup.ts`), so running the
test suite never touches your development data, and CI needs no
pre-started services.

## MinIO image pinning

The `minio/minio` repository on Docker Hub no longer exists (verified
2026-09-21: `pull access denied ... repository does not exist`). Both MinIO
images are therefore pulled from `quay.io/minio/*` and pinned to a specific
release tag so a fresh checkout pulls the same thing. If quay.io stops
serving them too, this is the file to change. Replacing MinIO with another S3-compatible server for local use
is a one-line change here and requires nothing else, because the platform
only ever speaks the S3 API through `packages/storage-adapter` (`ADR-001`).
