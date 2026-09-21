# 00 - Coding Context

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

> **Master reference for AI agents and developers.** The single file to read
> at the start of every session before writing code. Everything here is a
> summary of a longer document in this category -- follow the link when the
> summary is not enough.

## Purpose

Give whoever is about to write code enough context to write it in the right
place, in the right shape, calling the right layer -- without first reading
all 300+ specification documents. This file is deliberately short and
deliberately opinionated.

---

## 1. What this system is

An **Image Infrastructure API**: consumer applications call it over HTTP to
upload, store, transform, and deliver images, and never learn what object
storage sits underneath.

```
Asset Storage != Image Processing != Image Delivery != Consumer Application
```

Two contracts, equal in weight:

- **Management** -- `docs/API/`: create, read, search, delete assets.
- **Delivery** -- `docs/IMAGE-DELIVERY-PROTOCOL/`: the URL format and
  transformation parameters a CDN edge, a browser, and every SDK must agree
  on byte-for-byte.

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.9, `strict: true` | ESM only; bundler resolution; pinned for `typescript-eslint` (`ADR-018`). |
| Runtime | Node.js LTS | Version pinned in `.nvmrc` and `engines`. |
| Workspace | pnpm workspaces + Turborepo | One package per service; shared code in `packages/`. |
| HTTP | Fastify 5 (`P0-08`) | See `ADR-019`. |
| Database | PostgreSQL | |
| Migrations / query layer | Kysely + `pg` (`P0-06`) | See `ADR-020`; `scoped()` is built on it. |
| Cache | Redis | |
| Queue | BullMQ on Redis | Processing + webhook delivery. Never inline (ADR-007). |
| Image processing | `sharp` (libvips) | Confirmed in `P3-01`. |
| Object storage | S3-compatible adapter | S3 / R2 / MinIO from one implementation (ADR-002). |
| IDs | ULID | Sortable, non-enumerable (ADR-003). |
| Validation | Zod | The schema is the single source of both runtime validation and the TS type. |
| Logging | pino, JSON to stdout | See [`12-LOGGING-CONVENTIONS.md`](./12-LOGGING-CONVENTIONS.md). |
| Tests | Vitest + Testcontainers | See [`09-TESTING-CONVENTIONS.md`](./09-TESTING-CONVENTIONS.md). |

Anything not in this table and not in `AGENTS.md`'s default stack is an
ADR-worthy choice: write it into `MEMORY/DECISIONS.md` before adding the
dependency, not after.

## 3. Directory structure

```
image-delivery/
├── docs/                         # The specification (this file lives here)
├── TASKS/                        # The execution plan
├── MEMORY/                       # ADRs + one record per completed task
├── deploy/
│   ├── docker-compose.yml        # Postgres, Redis, MinIO (P0-02)
│   └── README.md
├── packages/                     # Shared code -- no service-specific logic
│   ├── config/                   # Typed env loading + validation (P0-04)
│   ├── errors/                   # AppError hierarchy + error code registry
│   ├── logger/                   # pino factory + redaction list (P0-05)
│   ├── db/                       # Connection, migrations, base repository
│   ├── schema/                   # Zod schemas shared across services
│   ├── storage-adapter/          # StorageAdapter interface + S3 impl (ADR-001)
│   ├── transform-params/         # Normalization + params_hash (ADR-004)
│   ├── tenancy/                  # TenantContext, permissions, RBAC matrix
│   ├── queue/                    # Queue interface: BullMQ + in-memory (ADR-007)
│   ├── cache/                    # Cache interface: Redis + in-memory
│   ├── image-engine/             # sharp/libvips pipeline (ADR-016 settings)
│   ├── signing/                  # Signed-URL canonical string + HMAC (ADR-006)
│   └── test-utils/               # Fixtures, factories, isolation helpers
├── services/                     # Two deployables (ADR-017)
│   ├── api/                      # HTTP: /v1 management, /i delivery, admin
│   └── worker/                   # Queue consumers: derivatives, webhooks, usage
├── apps/
│   ├── dashboard/                # Developer/admin UI (docs/UI-UX/)
│   └── website/                  # Marketing site + docs (docs/WEBSITE/)
├── sdks/                         # typescript, react, php, go (docs/SDK/)
├── .env.example
├── tsconfig.base.json
└── turbo.json
```

Inside a service, code is grouped by **domain module**, not by layer:

```
services/api/src/
├── modules/
│   ├── asset/
│   │   ├── asset.routes.ts       # HTTP surface only
│   │   ├── asset.controller.ts   # req/res <-> plain values
│   │   ├── asset.service.ts      # business rules, transactions
│   │   ├── asset.repository.ts   # data access, tenant-scoped
│   │   ├── asset.schema.ts       # Zod request/response schemas
│   │   ├── asset.mapper.ts       # row <-> domain <-> wire
│   │   ├── asset.types.ts        # domain types
│   │   └── asset.service.test.ts # colocated unit test
│   ├── folder/
│   └── upload/
├── middlewares/
├── jobs/                         # BullMQ producers/consumers
├── app.ts                        # Wiring only
└── server.ts                     # Entry point: listen, signals, shutdown
```

Full rationale: [`02-PROJECT-STRUCTURE.md`](./02-PROJECT-STRUCTURE.md).

## 4. Layering rule -- the one diagram to memorize

```
  routes  ->  controller  ->  service  ->  repository  ->  packages/db
     |             |              |             |
     |             |              |             +-- may use: db, logger, errors
     |             |              +---- may use: repository, other services'
     |             |                    clients, packages/*, queue producers
     |             +---- may use: service, schema. NEVER db, NEVER repository.
     +---- may use: controller, middleware, schema. No logic at all.
```

Enforced, not just documented:

| Rule | Enforced by |
|---|---|
| A controller never imports a repository or `packages/db` | ESLint `no-restricted-imports` (see section 10) |
| A service never imports HTTP request/response types | ESLint `no-restricted-imports` |
| Service A never imports service B's internals | `eslint-plugin-boundaries` + `dependency-cruiser` in CI |
| No package outside `packages/storage-adapter` imports an S3 SDK | ESLint `no-restricted-imports` (ADR-001) |
| No package outside `packages/transform-params` computes a params hash | Review rule + a golden-vector test (ADR-004) |

## 5. The five rules that are never negotiable

1. **Every repository method takes `TenantContext` as its first parameter.**
   Not "should" -- the signature is the enforcement mechanism (ADR-005). A
   method that reads a tenant id off a global, a module-level variable, or
   an `AsyncLocalStorage` as its *only* source is a review-blocking finding.
2. **Every `:id`-scoped endpoint ships an IDOR/BOLA test** proving Tenant A
   asking for Tenant B's ULID gets `404`. No exceptions for "simple"
   endpoints (`TASKS/00-TASK-CONVENTIONS.md`).
3. **One normalization function.** `normalizeTransformParams()` and
   `computeParamsHash()` in `packages/transform-params` feed the CDN cache
   key, the derivative storage object key, and `derivative_id`. Three
   implementations that agree today is exactly the bug ADR-004 exists to
   prevent.
4. **Nothing slow or third-party-dependent runs on the request path.**
   Image processing and webhook delivery go through BullMQ (ADR-007).
5. **Secrets, API keys, and signed-URL signatures never reach a log, an
   error message, or a response body.** The redaction list in
   `packages/logger` is code, not a guideline.

## 6. Naming at a glance

| Thing | Convention | Example |
|---|---|---|
| Directory | `kebab-case` | `image-processing-service/` |
| Source file | `kebab-case` + layer suffix | `asset.service.ts`, `tenant-scope.middleware.ts` |
| Test file | `<subject>.test.ts` / `.int.test.ts` | `asset.service.test.ts` |
| Type / interface / class | `PascalCase`, no `I` prefix | `StorageAdapter`, `TenantContext` |
| Function / variable | `camelCase`, verb-first for functions | `createAsset`, `computeParamsHash` |
| Constant / enum member | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_BYTES`, `ASSET_STATUS.READY` |
| Zod schema | `<thing>Schema` | `createAssetBodySchema` |
| DB table / column | `snake_case`, plural tables | `asset_versions`, `params_hash` |
| Wire JSON field | `snake_case` | `"created_at"`, `"content_type"` |
| Env var | `UPPER_SNAKE_CASE` | `STORAGE_S3_BUCKET` |
| Error code | `snake_case` domain string | `asset_not_found`, `quota_exceeded` |
| Redis key | `img:v1:<tenant>:<entity>:<id>` | `img:v1:t_01J.../asset:a_01J...` |
| Queue / job | `kebab-case` | `image-processing`, `generate-derivative` |
| Branch | `feat/P{phase}-{seq}-summary` | `feat/P2-07-presigned-upload` |
| Commit | `P{phase}-{seq}: <imperative>` | `P2-07: add presigned upload endpoint` |

Details and reasoning: [`03-NAMING-CONVENTIONS.md`](./03-NAMING-CONVENTIONS.md).

## 7. Response shapes (code-side pattern)

Success:

```json
{ "data": { "id": "a_01J...", "content_type": "image/jpeg" }, "meta": { "request_id": "r_01J..." } }
```

Error:

```json
{
  "error": {
    "code": "asset_not_found",
    "message": "No asset with that id exists in this project.",
    "details": [],
    "request_id": "r_01J..."
  }
}
```

Constructed only through `ok()` / `AppError` from `packages/errors` -- never
a hand-written object literal in a controller. The normative wire contract
is `docs/API/01-API-STANDARDS.md` + `docs/API/05-ERROR-HANDLING.md`,
ratified by `P0-09`; see
[`06-ERROR-RESPONSE-STANDARDS.md`](./06-ERROR-RESPONSE-STANDARDS.md).

## 8. Common agent tasks -- the file checklist

### Adding an endpoint

1. `docs/API/*.md` -- if the shape is not already precisely specified, write
   it there **first**, in the same change (`AGENTS.md` hard rule).
2. `<module>.schema.ts` -- Zod schema for params, query, body, response.
3. `<module>.repository.ts` -- data access, `TenantContext` first parameter.
4. `<module>.service.ts` -- business rules; returns domain types, throws `AppError`.
5. `<module>.controller.ts` -- parse via schema, call service, `ok(...)`.
6. `<module>.routes.ts` -- method, path, middleware chain, permission name.
7. `<module>.service.test.ts` -- unit tests including the failure paths.
8. `tests/integration/<module>.int.test.ts` -- including the **mandatory
   cross-tenant 404 test** if the route has an `:id`.
9. `MEMORY/records/{TASK-ID}.md` + `TASKS/PROGRESS.md`.

### Adding a transformation parameter

1. `docs/IMAGE-DELIVERY-PROTOCOL/` -- the parameter's normative definition.
2. `packages/transform-params` -- the param registry **and** the normalizer.
3. The golden test-vector fixture -- new vectors for the parameter, plus
   proof that existing vectors' hashes did not change.
4. `packages/schema` -- the delivery query schema.
5. `services/image-processing-service` -- the pipeline step, at the position
   `docs/IMAGE-DELIVERY-PROTOCOL/16-TRANSFORMATION-PIPELINE.md` fixes.
6. Never change an existing parameter's normalization without an ADR -- it
   invalidates every cache and storage key in existence (ADR-004).

### Adding a queue job

1. `jobs/<name>.job.ts` -- payload Zod schema, handler, idempotency key.
2. Register in the queue's job map; set attempts, backoff, and DLQ policy.
3. A test that the handler is idempotent under redelivery.
4. See [`08-CACHE-QUEUE-STANDARDS.md`](./08-CACHE-QUEUE-STANDARDS.md).

### Adding a storage provider

1. A new adapter implementing `StorageAdapter` -- nothing else changes.
2. Pass the shared conformance suite unmodified (`P0-07`).
3. No provider SDK import leaks outside the adapter package (ADR-001).

## 9. Where to look when you are stuck

| Question | File |
|---|---|
| What task am I on? | `TASKS/PROGRESS.md` |
| What are the rules of working here? | `AGENTS.md` |
| Why is it like this? | `MEMORY/DECISIONS.md` |
| What happened on the task I depend on? | `MEMORY/records/{TASK-ID}.md` |
| What exactly must this endpoint return? | `docs/API/` |
| What exactly must this URL do? | `docs/IMAGE-DELIVERY-PROTOCOL/` |
| Can I loosen this check? | No. See `docs/SECURITY/` and the hard rules in `AGENTS.md`. |
| How do I write this file? | [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md) |

## Acceptance Criteria

- [x] Names the stack, the layout, the layering rule, and the naming table
      without requiring another document to be read first.
- [x] Every non-negotiable rule traces to an ADR or to
      `TASKS/00-TASK-CONVENTIONS.md` rather than being asserted here.
- [x] States explicitly which choices are still open (query layer: `P0-06`;
      HTTP framework: `P0-08`) instead of silently assuming one.

## Open Questions

- Query layer / migration tool is chosen in `P0-06`; update section 2 and
  [`07-REPOSITORY-DATABASE-STANDARDS.md`](./07-REPOSITORY-DATABASE-STANDARDS.md)
  in that same change.
- HTTP framework is chosen in `P0-08`; the layer templates in
  [`05-LAYER-TEMPLATES.md`](./05-LAYER-TEMPLATES.md) gain concrete framework
  types then.
- Final service/package names are confirmed by `P0-01`; section 3 is the
  proposed layout until then.

## Related Documents

- `docs/ENGINEERING/README.md` (category index)
- `docs/ENGINEERING/01-CODING-STANDARDS.md` (the detailed standard)
- `AGENTS.md`, `CLAUDE.md` (operating instructions -- read before this file)
- `MEMORY/DECISIONS.md` (`ADR-010`, `ADR-011` introduce this category)
