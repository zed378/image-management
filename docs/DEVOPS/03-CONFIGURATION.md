# 03 - Configuration

> Category: **DevOps** (`docs/DEVOPS/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How configuration reaches a process, how it is validated, and what happens
when it is wrong.

## Category Mandate

Environments, containerization, CI/CD, configuration and secrets management,
migrations, backup/restore, and disaster recovery.

---

## The rules

1. **Configuration is injected at runtime, never baked into an image.** The
   same image runs everywhere (`01-CONTAINERIZATION.md`).
2. **`packages/config` is the only code that reads `process.env`.** Every
   other package receives configuration as an argument, which is what lets a
   test construct three differently-configured instances in one file.
3. **A process with invalid configuration refuses to start.** Exit code `1`,
   with every problem listed on stderr at once. A process that starts and
   fails on its first request is harder to diagnose and may already have
   passed a liveness probe.
4. **No secret has a default value.** A missing secret is a startup failure,
   never a silently-used placeholder.
5. **Error messages name variables, never values.** A configuration error is
   safe to print and to ship to a log aggregator even when the offending
   value is a password.

## Precedence

```
process environment   (highest -- what the orchestrator injects)
        |
      .env            (local development only; ignored when NODE_ENV=production)
        |
 schema defaults      (lowest -- only for non-secret values)
```

`withDotEnv()` merges a `.env` file *under* the real environment, so a value
exported in the shell always wins. In production the file is not read at
all: a stray `.env` baked into an image is ignored.

Empty values (`KEY=`) are treated as unset, so an empty required secret is a
startup failure rather than an empty-string credential.

## How it works

Each deployable composes its schema from shared fragments in
`packages/config`:

```ts
// services/api/src/config.ts
const apiEnvSchema = z
  .object({
    ...processFragment,
    ...databaseFragment,
    ...redisFragment,
    ...storageFragment,
    HTTP_HOST: z.string().min(1).default("0.0.0.0"),
    HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  })
  .superRefine(refineStorage);
```

The schema is defined over **environment variable names** and then mapped to
a nested, typed object (`ApiConfig`, `WorkerConfig`). Defining it over the
flat names is deliberate: every validation error then names the variable the
operator must change.

A failed boot looks like this:

```
api: invalid configuration (2 problems):
  - DATABASE_URL: is required but not set
  - STORAGE_S3_BUCKET: is required when STORAGE_PROVIDER=s3
```

## Variables

Grouped by fragment. Required means "no default; boot fails without it".

### Process (all deployables)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test`, `production` |
| `LOG_LEVEL` | no | `info` | `fatal` .. `trace`, `silent` |
| `SERVICE_VERSION` | no | `dev` | Set by the deploy pipeline; appears on every log line |

### Database

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | **yes** | -- | `postgres://` or `postgresql://`. Secret: contains the password |
| `DATABASE_POOL_MAX` | no | `10` | 1-200 |
| `DATABASE_STATEMENT_TIMEOUT_MS` | no | `5000` | 100-600000 |

### Redis

| Variable | Required | Default | Notes |
|---|---|---|---|
| `REDIS_URL` | **yes** | -- | `redis://` or `rediss://`. Secret if it carries a password |

### Storage

Provider-specific requirements are cross-field rules, reported as
"is required when STORAGE_PROVIDER=...". Full guidance per provider:
`docs/STORAGE/10-STORAGE-PROVIDER-ADAPTER.md`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `STORAGE_PROVIDER` | no | `local` | `local`, `s3`, `azure-blob`, `sftp`, `webdav` (`ADR-021`) |
| `STORAGE_LOCAL_ROOT` | in production, when `local` | `.data/storage` | A local directory or a mounted NFS/SMB/EFS share; shared across hosts if multi-host |
| `STORAGE_S3_BUCKET` | when `s3` | -- | |
| `STORAGE_S3_REGION` | no | `us-east-1` | |
| `STORAGE_S3_ENDPOINT` | no | AWS default | Set for R2, MinIO, GCS interop, any S3-compatible store |
| `STORAGE_S3_ACCESS_KEY_ID` | paired | -- | Both or neither; neither means an IAM role |
| `STORAGE_S3_SECRET_ACCESS_KEY` | paired | -- | Secret |
| `STORAGE_S3_FORCE_PATH_STYLE` | no | `false` | `true` for MinIO |
| `STORAGE_AZURE_ACCOUNT_NAME` | when `azure-blob` | -- | |
| `STORAGE_AZURE_ACCOUNT_KEY` | when `azure-blob` | -- | Secret |
| `STORAGE_AZURE_CONTAINER` | when `azure-blob` | -- | |
| `STORAGE_AZURE_ENDPOINT` | no | public cloud | Azurite or a sovereign cloud |
| `STORAGE_SFTP_HOST` | when `sftp` | -- | |
| `STORAGE_SFTP_PORT` | no | `22` | |
| `STORAGE_SFTP_USERNAME` | when `sftp` | -- | |
| `STORAGE_SFTP_PASSWORD` / `STORAGE_SFTP_PRIVATE_KEY` | one, when `sftp` | -- | Secret; `
` in the key becomes a newline |
| `STORAGE_SFTP_ROOT` | no | `/` | |
| `STORAGE_SFTP_HOST_KEY_SHA256` | in production, when `sftp` | -- | Pinned host key; MITM defence |
| `STORAGE_WEBDAV_URL` | when `webdav` | -- | |
| `STORAGE_WEBDAV_USERNAME` / `STORAGE_WEBDAV_PASSWORD` | no | -- | Password is a secret |
| `STORAGE_WEBDAV_ROOT` | no | `/` | |

### `api` only

| Variable | Required | Default |
|---|---|---|
| `HTTP_HOST` | no | `0.0.0.0` |
| `HTTP_PORT` | no | `3000` |

### `worker` only

| Variable | Required | Default | Notes |
|---|---|---|---|
| `WORKER_IMAGE_CONCURRENCY` | no | `2` | Concurrent encode jobs per process |
| `WORKER_WEBHOOK_CONCURRENCY` | no | `8` | Concurrent webhook deliveries per process |

Later tasks add variables for signing, delivery, CDN, and quotas; each adds
its row here in the same change. `.env.example` lists every variable with
local values.

## Per-tenant overrides

Not environment configuration. Per-tenant and per-project settings (dimension
ladder, strict parameters, referrer allow-lists, quotas) live in the database
and are read through the owning module, because they change at runtime and
differ per customer. Environment configuration is per *deployment*.

## Verification

- `packages/config/src/config.test.ts` -- 16 tests: defaults, every required
  variable named when missing, all problems reported at once, empty string as
  unset, **no secret value in any error message**, enum values listed,
  cross-field storage rules, `.env` precedence, `.env` ignored in production.
- `services/api/tests/boot.test.ts` -- spawns the real `api` and `worker`
  entry points: each starts with the required variables, and each refuses to
  start (exit `1`, variable named on stderr) when any one is removed.

## Acceptance Criteria

- [x] One place reads the environment; every deployable boots through it.
- [x] Removing any required variable causes a named startup failure,
      verified against the real processes.
- [x] The precedence order is implemented and tested, including the
      production exclusion of `.env`.
- [x] Every variable is documented with requirement, default, and secrecy.

## Open Questions

- None for the mechanism. Each later task that adds a variable owns its row.

## Related Documents

- `packages/config/`, `services/*/src/config.ts`, `.env.example`
- `docs/DEVOPS/04-SECRETS-MANAGEMENT.md`
- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 19)
