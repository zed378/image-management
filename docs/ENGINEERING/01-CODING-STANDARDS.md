# 01 - Coding Standards & Guidelines

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

The detailed standard. Open this while writing a specific file. For the
one-page orientation, read [`00-CODING-CONTEXT.md`](./00-CODING-CONTEXT.md)
first.

Two conventions used throughout:

- **MUST / MUST NOT** -- a review-blocking rule. A pull request that
  violates one does not merge.
- **SHOULD** -- the default. Deviating is allowed, but the reason goes in
  the pull request description (and in `MEMORY/records/{TASK-ID}.md` if it
  will recur).

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Naming Conventions](#2-naming-conventions)
3. [File & Module Structure](#3-file--module-structure)
4. [TypeScript Standards](#4-typescript-standards)
5. [Route Standards](#5-route-standards)
6. [Controller Standards](#6-controller-standards)
7. [Validation & Schema Standards](#7-validation--schema-standards)
8. [Service Standards](#8-service-standards)
9. [Repository & Tenant Scoping Standards](#9-repository--tenant-scoping-standards)
10. [Storage Adapter Standards](#10-storage-adapter-standards)
11. [Transformation Parameter Standards](#11-transformation-parameter-standards)
12. [Error Handling](#12-error-handling)
13. [Response Format](#13-response-format)
14. [Authorization & Permission Format](#14-authorization--permission-format)
15. [Database Standards](#15-database-standards)
16. [Caching Standards](#16-caching-standards)
17. [Queue & Worker Standards](#17-queue--worker-standards)
18. [Logging & Observability Standards](#18-logging--observability-standards)
19. [Configuration & Environment Variables](#19-configuration--environment-variables)
20. [Constants Standards](#20-constants-standards)
21. [Migration & Seeding Standards](#21-migration--seeding-standards)
22. [Testing Standards](#22-testing-standards)
23. [Tooling, Lint & Format](#23-tooling-lint--format)
24. [Git, Review & Deployment](#24-git-review--deployment)
25. [Quick Reference](#25-quick-reference)

---

## 1. Project Overview

### Technology Stack

| Component | Technology | Version / Notes |
|---|---|---|
| Language | TypeScript | 5.9 pinned, `strict: true`, ESM only (`ADR-018`) |
| Runtime | Node.js | LTS, pinned in `.nvmrc` + `engines` |
| Workspace | pnpm workspaces + Turborepo | one package per service boundary |
| HTTP framework | Fastify 5 | `ADR-020` |
| Database | PostgreSQL | 15+ |
| Query layer / migrations | Kysely + `pg` | `ADR-019` |
| Cache | Redis (ioredis) | |
| Queue | BullMQ | on Redis; processing + webhook delivery |
| Image processing | `sharp` (libvips) | confirmed in `P3-01` |
| Object storage | S3-compatible adapter | S3 / R2 / MinIO (ADR-002) |
| Validation | Zod | 3.x; schema is also the type source |
| IDs | ULID | user-facing resource ids (ADR-003) |
| Logging | pino | JSON to stdout |
| Metrics / tracing | OpenTelemetry | per `docs/OBSERVABILITY/` |
| Tests | Vitest + Testcontainers | unit + integration |
| Container | Docker + Docker Compose | local infra in `deploy/` |

An addition to this table is an ADR (`MEMORY/DECISIONS.md`), written
**before** the dependency lands in `package.json`.

### Project Structure

See [`00-CODING-CONTEXT.md`](./00-CODING-CONTEXT.md) section 3 for the tree
and [`02-PROJECT-STRUCTURE.md`](./02-PROJECT-STRUCTURE.md) for the rules
about what may live where. The two load-bearing decisions:

- **`services/*` are deployables.** A service MUST NOT import another
  service's source. Cross-service communication goes through a published
  HTTP contract, and the client for it lives in `packages/`.
- **`packages/*` are libraries.** A package MUST NOT import a service, MUST
  NOT read `process.env` directly (it takes config as an argument), and MUST
  NOT contain business rules specific to one service.

---

## 2. Naming Conventions

### File names

All file names are `kebab-case` with an explicit layer suffix. The suffix is
how a reader (and a lint rule) knows which layering rules apply.

| Layer | Pattern | Example |
|---|---|---|
| Routes | `<module>.routes.ts` | `asset.routes.ts` |
| Controller | `<module>.controller.ts` | `asset.controller.ts` |
| Service | `<module>.service.ts` | `asset.service.ts` |
| Repository | `<module>.repository.ts` | `asset.repository.ts` |
| Zod schemas | `<module>.schema.ts` | `asset.schema.ts` |
| Mappers | `<module>.mapper.ts` | `asset.mapper.ts` |
| Domain types | `<module>.types.ts` | `asset.types.ts` |
| Middleware | `<name>.middleware.ts` | `tenant-scope.middleware.ts` |
| Queue job | `<name>.job.ts` | `generate-derivative.job.ts` |
| Utility | `<name>.util.ts` | `params-hash.util.ts` |
| Constants | `<name>.constants.ts` | `asset.constants.ts` |
| Unit test | `<subject>.test.ts` | `asset.service.test.ts` |
| Integration test | `<subject>.int.test.ts` | `asset-api.int.test.ts` |
| Conformance test | `<subject>.conformance.test.ts` | `storage-adapter.conformance.test.ts` |

Multi-word modules keep the kebab: `asset-version.service.ts`, not
`assetVersion.service.ts`.

### Identifier names

- **Types, interfaces, classes, enums** -- `PascalCase`. No `I` prefix, no
  `T` prefix: `StorageAdapter`, not `IStorageAdapter`.
- **Functions** -- `camelCase`, verb first: `createAsset`, `findAssetById`,
  `computeParamsHash`, `assertTenantOwns`.
- **Variables** -- `camelCase`. Booleans read as predicates: `isPublic`,
  `hasDerivative`, `shouldReprocess`.
- **Module-level constants** -- `UPPER_SNAKE_CASE`: `MAX_UPLOAD_BYTES`,
  `DEFAULT_PAGE_SIZE`, `SIGNED_URL_MAX_TTL_SECONDS`.
- **Const objects used as enums** -- `UPPER_SNAKE_CASE` name, `UPPER_SNAKE_CASE`
  keys, `as const`: `ASSET_STATUS.READY`, `ERROR_CODES.ASSET_NOT_FOUND`.
- **Zod schemas** -- `<thing>Schema` in `camelCase`:
  `createAssetBodySchema`, `assetIdParamSchema`, `deliveryQuerySchema`.
- **Type inferred from a schema** -- same name in `PascalCase`:
  `type CreateAssetBody = z.infer<typeof createAssetBodySchema>`.

### Function naming by layer

Consistent verbs make a call site's layer obvious:

| Layer | Verbs | Example |
|---|---|---|
| Controller | `handle*` or the HTTP-ish action | `handleCreateAsset` |
| Service | domain verbs | `createAsset`, `softDeleteAsset`, `requestDerivative` |
| Repository | `find*` / `insert*` / `update*` / `delete*` / `count*` | `findById`, `insertOne`, `countByProject` |
| Mapper | `to*` | `toAssetDomain`, `toAssetWire`, `toAssetRow` |
| Guard / assertion | `assert*` / `ensure*` | `assertQuotaAvailable` |
| Predicate | `is*` / `has*` / `can*` | `isProcessableMimeType` |

`find*` returns `T | null`. `get*` throws if absent. Never mix the two --
this distinction is what keeps "404 vs. crash" decisions in the service
layer instead of scattered through repositories.

### Domain naming (do not improvise)

These words have fixed meanings across `docs/`. Using them loosely produces
code that contradicts the specification it claims to implement.

| Term | Means | Does not mean |
|---|---|---|
| **Asset** | The logical image resource a consumer created and owns | A file, a byte range, a URL |
| **Original** | The immutable uploaded bytes | The current version |
| **Derivative** | A transformed output, identified by `derivative_id` | A thumbnail specifically |
| **Version** | A new set of original bytes for the same asset | A derivative |
| **Object** | A single stored blob in a storage backend | An asset |
| **Object key** | The storage backend path of an object | A cache key, a URL |
| **Cache key** | The CDN/edge identity of a response | The object key |
| **`params_hash`** | The hash of normalized transformation params (ADR-004) | An arbitrary hash |
| **Project** | The tenant sub-scope assets belong to | The tenant |
| **Application** | The API-key-bearing client of a project | A user |

### Other names

- **DB tables** -- `snake_case`, plural: `assets`, `asset_versions`,
  `api_keys`. **Columns** -- `snake_case`: `content_type`, `created_at`.
- **Wire JSON fields** -- `snake_case`, matching the column name wherever
  the field is a direct projection of one.
- **Env vars** -- `UPPER_SNAKE_CASE`, grouped by a domain prefix:
  `DB_`, `REDIS_`, `STORAGE_`, `CDN_`, `AUTH_`, `QUEUE_`, `OTEL_`.
- **Error codes** -- `snake_case`, `<subject>_<problem>`: `asset_not_found`,
  `unsupported_media_type`, `quota_exceeded`, `signature_invalid`.
- **Permissions** -- `<resource>:<action>` or `<resource>:<scope>:<action>`
  (see section 14): `asset:read`, `asset:project:delete`, `admin:tenant:read`.

---

## 3. File & Module Structure

### Rules

1. One module directory per domain concept. A module that grows past ~8
   files SHOULD be split by sub-concept (`asset/`, `asset-version/`), not by
   adding a `helpers/` grab bag.
2. Each file has **one** default responsibility and **no** default export.
   Named exports only -- they rename consistently and refactor safely.
3. Import order, enforced by lint: node builtins, external packages,
   `@image-delivery/*` workspace packages, relative imports, then type-only
   imports. One blank line between groups.
4. A file MUST NOT exceed ~400 lines. Past that, the module wants splitting.
5. Section banners are used in files with more than three exports, so a long
   service file stays scannable:

```ts
// ==========================================
// CREATE
// ==========================================
```

### Module file responsibilities

| File | Owns | MUST NOT |
|---|---|---|
| `*.routes.ts` | Path, method, middleware order, permission name | Contain any logic or touch a service directly beyond the controller |
| `*.controller.ts` | Parsing the request into plain values; calling one service function; shaping the response | Import a repository, `packages/db`, or a storage SDK; contain business rules; `try/catch` |
| `*.service.ts` | Business rules, orchestration, transaction boundaries, authorization decisions | Reference HTTP request/response objects, status codes, or headers |
| `*.repository.ts` | Data access for one aggregate, always tenant-scoped | Contain business rules, call another repository, or enqueue jobs |
| `*.schema.ts` | Zod schemas + inferred types | Import a service or repository |
| `*.mapper.ts` | Pure conversion between row / domain / wire shapes | Perform I/O |
| `*.types.ts` | Domain types and branded ids | Import anything with a side effect |

The two rules with the most leverage: **controllers know HTTP and nothing
else; services know the domain and nothing about HTTP.** A service that
takes a `Request` cannot be unit-tested or reused by a worker, and this
platform runs half its work in workers.

---

## 4. TypeScript Standards

### Compiler settings (`tsconfig.base.json`)

Non-negotiable flags:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2023",
    "noEmit": true
  }
}
```

`noUncheckedIndexedAccess` is here on purpose: this codebase parses
untrusted query strings and header values constantly, and the flag turns a
whole class of "the param was absent" bugs into compile errors.

### Rules

- `any` is banned (`@typescript-eslint/no-explicit-any` as an error). Use
  `unknown` at a boundary and narrow with a Zod schema.
- Type assertions (`as`) are a code smell outside of: (a) `as const`,
  (b) narrowing immediately after a Zod `parse`, (c) a documented brand
  cast inside a `*.types.ts` factory. Each other use needs a one-line
  comment saying why it is safe.
- No non-null assertion (`!`). Narrow explicitly, or throw an `AppError`.
- **Branded ids.** Resource ids are not interchangeable strings. Passing a
  `ProjectId` where an `AssetId` belongs is precisely the kind of mistake
  that produces a cross-tenant lookup, so the compiler gets to catch it:

```ts
// asset.types.ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type ProjectId = Brand<string, "ProjectId">;
export type AssetId = Brand<string, "AssetId">;
export type DerivativeId = Brand<string, "DerivativeId">;

export const toAssetId = (raw: string): AssetId => {
  if (!isUlid(raw)) throw new BadRequestError(ERROR_CODES.INVALID_ID);
  return raw as AssetId;
};
```

- Prefer `type` for object shapes and unions; use `interface` only for a
  contract intended to be implemented by several classes (e.g.
  `StorageAdapter`).
- Discriminated unions over boolean flags for states:
  `{ status: "pending" } | { status: "ready"; objectKey: string }` makes the
  illegal combination unrepresentable.
- `readonly` on every field of a domain type and on array parameters
  (`readonly string[]`). Domain objects are values, not mutable buffers.
- Every exported function has an explicit return type. Inference is fine
  inside a function, never at a module boundary.
- `async` functions return `Promise<T>`; never mix a callback and a promise
  in the same API. No floating promises
  (`@typescript-eslint/no-floating-promises` as an error) -- a fire-and-forget
  job enqueue is still `await`ed or explicitly `void`ed with a comment.

More: [`04-TYPESCRIPT-STANDARDS.md`](./04-TYPESCRIPT-STANDARDS.md).

---

## 5. Route Standards

A route file is a declaration of the HTTP surface. It answers: what path,
what method, which middleware, which permission, which controller. Nothing
else.

### Template

```ts
// asset.routes.ts
import { Router } from "<http-framework>"; // finalized in P0-08

import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { idempotency } from "../../middlewares/idempotency.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { PERMISSIONS } from "../../constants/permissions.constants.js";

import * as assetController from "./asset.controller.js";
import {
  assetIdParamSchema,
  createAssetBodySchema,
  listAssetsQuerySchema,
} from "./asset.schema.js";

export const assetRoutes = Router();

// POST /v1/assets
assetRoutes.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.ASSET_CREATE),
  idempotency,
  validate({ body: createAssetBodySchema }),
  assetController.handleCreateAsset,
);

// GET /v1/assets
assetRoutes.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.ASSET_READ),
  validate({ query: listAssetsQuerySchema }),
  assetController.handleListAssets,
);

// GET /v1/assets/:assetId
assetRoutes.get(
  "/:assetId",
  authenticate,
  requirePermission(PERMISSIONS.ASSET_READ),
  validate({ params: assetIdParamSchema }),
  assetController.handleGetAsset,
);
```

### Rules

- Paths are plural nouns, `kebab-case`, no verbs: `/assets/:assetId/versions`,
  never `/getAsset`.
- Version prefix (`/v1`) is mounted once in `app.ts`, never repeated in a
  module's route file.
- Path parameters are named for the resource: `:assetId`, `:projectId` --
  never a bare `:id`. A bare `:id` in a nested route is how the wrong
  resource's id gets read.
- **Middleware order is fixed** and MUST NOT be reordered per-route:
  1. request id / logging context
  2. body limits + parsing
  3. `authenticate` (who is calling)
  4. tenant context resolution
  5. rate limiting (needs the identity to key on)
  6. `requirePermission` (may they)
  7. `idempotency` (mutating routes only)
  8. `validate` (schema)
  9. controller
- Every route names its permission explicitly via `requirePermission`. A
  route with no permission middleware MUST carry a comment stating why it is
  public (health checks, the delivery endpoint) -- silence is not an
  exemption.
- Every `:id`-bearing route added here means an IDOR/BOLA test is now owed
  (`TASKS/00-TASK-CONVENTIONS.md`).

---

## 6. Controller Standards

### Template

```ts
// asset.controller.ts
import type { RequestHandler } from "<http-framework>"; // P0-08

import { ok, created, noContent } from "@image-delivery/errors";

import * as assetService from "./asset.service.js";
import { toAssetWire } from "./asset.mapper.js";
import { assetIdParamSchema, createAssetBodySchema } from "./asset.schema.js";

// ==========================================
// CREATE
// ==========================================

export const handleCreateAsset: RequestHandler = async (req, res) => {
  const body = createAssetBodySchema.parse(req.body);

  const asset = await assetService.createAsset(req.tenantContext, {
    ...body,
    idempotencyKey: req.idempotencyKey,
  });

  created(res, toAssetWire(asset), { location: `/v1/assets/${asset.id}` });
};

// ==========================================
// READ
// ==========================================

export const handleGetAsset: RequestHandler = async (req, res) => {
  const { assetId } = assetIdParamSchema.parse(req.params);

  const asset = await assetService.getAsset(req.tenantContext, assetId);

  ok(res, toAssetWire(asset));
};
```

### Rules

- A controller is at most ~15 lines: parse, call, respond. A branch in a
  controller is a business rule in the wrong file.
- **No `try/catch`.** The central error middleware owns error-to-HTTP
  mapping. A local `catch` either swallows context or duplicates the mapping
  table; both are worse than letting it propagate. The single exception: a
  `catch` that adds context and rethrows a typed `AppError`.
- MUST NOT construct a response object literal. Use `ok()` / `created()` /
  `noContent()` so the envelope stays in one place.
- MUST NOT read `req.body`/`req.query`/`req.params` without passing it
  through a Zod schema first, even for a single field, even when the
  `validate` middleware already ran -- the schema parse is what produces the
  typed value the rest of the function uses.
- MUST NOT read the tenant id out of the body, the query string, or a
  header. It comes from `req.tenantContext`, established by authentication
  and the tenant-context middleware. A tenant id a caller can influence is a
  cross-tenant vulnerability by construction.
- MUST NOT touch a repository, `packages/db`, Redis, or a storage SDK.
- Status codes: `200` read/update, `201` create (with `Location`), `202`
  accepted-for-async-processing, `204` delete, `304` conditional GET.

---

## 7. Validation & Schema Standards

Zod schemas are the boundary between untrusted input and typed code, and the
single source of the corresponding TypeScript types.

### Template

```ts
// asset.schema.ts
import { z } from "zod";

import { MAX_TAGS_PER_ASSET, MAX_UPLOAD_BYTES } from "./asset.constants.js";

// ==========================================
// PRIMITIVES (reused -- do not redefine locally)
// ==========================================

export const ulidSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "must be a ULID");

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(512).optional(),
});

// ==========================================
// REQUESTS
// ==========================================

export const assetIdParamSchema = z.object({ assetId: ulidSchema });

export const createAssetBodySchema = z
  .object({
    filename: z.string().min(1).max(255),
    content_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
    byte_size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    folder_id: ulidSchema.optional(),
    tags: z.array(z.string().min(1).max(64)).max(MAX_TAGS_PER_ASSET).default([]),
    visibility: z.enum(["private", "public"]).default("private"),
  })
  .strict();

export const listAssetsQuerySchema = paginationSchema
  .extend({
    folder_id: ulidSchema.optional(),
    tag: z.string().max(64).optional(),
    sort: z.enum(["created_at", "-created_at", "byte_size", "-byte_size"])
      .default("-created_at"),
  })
  .strict();

// ==========================================
// INFERRED TYPES
// ==========================================

export type CreateAssetBody = z.infer<typeof createAssetBodySchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
```

### Rules

- Every request schema is `.strict()`. An unknown field is a client bug or
  an attack probe; silently dropping it hides both. (The one exception is
  the delivery query string, where
  `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md` defines the
  handling of unknown parameters -- follow that document, not this rule.)
- Every string has a `max()`. An unbounded string is a memory and
  log-flooding vector.
- Every numeric bound comes from a named constant, not an inline literal --
  so the API doc, the schema, and the quota check cannot disagree.
- Wire field names in schemas are `snake_case`, matching the API contract.
  The mapper converts to `camelCase` domain fields; schemas do not.
- Shared schemas (anything used by more than one service, notably the
  delivery query and the transformation params) live in `packages/schema`,
  not in a service. Two copies of the delivery schema is the same failure
  mode ADR-004 addresses.
- Zod `.transform()` is allowed for coercion and normalization, not for
  business logic. If a transform needs a database, it belongs in a service.
- A schema MUST NOT be the authorization check. Validation proves the shape
  is legal; only the service/repository layer proves the caller may touch
  the row.

---

## 8. Service Standards

Where the business rules live. A service function is callable from a
controller, a worker, a CLI, or a test, with no HTTP anywhere in sight.

### Template

```ts
// asset.service.ts
import type { TenantContext } from "@image-delivery/tenancy";
import { ConflictError, NotFoundError, ERROR_CODES } from "@image-delivery/errors";
import { logger } from "@image-delivery/logger";

import * as assetRepository from "./asset.repository.js";
import * as quotaService from "../quota/quota.service.js";
import { enqueueGenerateDerivative } from "../../jobs/generate-derivative.job.js";
import type { Asset, AssetId } from "./asset.types.js";
import type { CreateAssetBody } from "./asset.schema.js";

// ==========================================
// CREATE
// ==========================================

export const createAsset = async (
  ctx: TenantContext,
  input: CreateAssetBody & { idempotencyKey?: string },
): Promise<Asset> => {
  await quotaService.assertStorageAvailable(ctx, input.byte_size);

  return assetRepository.withTransaction(ctx, async (tx) => {
    if (input.folder_id) {
      const folder = await folderRepository.findById(ctx, input.folder_id, tx);
      if (!folder) throw new NotFoundError(ERROR_CODES.FOLDER_NOT_FOUND);
    }

    const existing = input.idempotencyKey
      ? await assetRepository.findByIdempotencyKey(ctx, input.idempotencyKey, tx)
      : null;
    if (existing) return existing;

    const asset = await assetRepository.insertOne(ctx, input, tx);

    logger.info({ asset_id: asset.id, byte_size: asset.byteSize }, "asset created");
    return asset;
  });
};

// ==========================================
// READ
// ==========================================

export const getAsset = async (ctx: TenantContext, assetId: AssetId): Promise<Asset> => {
  const asset = await assetRepository.findById(ctx, assetId);

  // Absent and foreign are deliberately indistinguishable to the caller:
  // docs/SECURITY/11-IDOR-BOLA-PREVENTION.md.
  if (!asset) throw new NotFoundError(ERROR_CODES.ASSET_NOT_FOUND);

  return asset;
};
```

### Rules

- **`TenantContext` is the first parameter of every exported service
  function.** Same reasoning as repositories (ADR-005): make the thing that
  must never be forgotten impossible to omit.
- A service throws `AppError` subclasses; it never returns
  `{ success, status, message }`. HTTP status lives in the error class and
  the error middleware, not in the return value. A service that returns a
  status code cannot be reused by a worker, which has no status codes.
- Transaction boundaries are owned by the service, never by a repository or
  a controller. One service call = at most one transaction; a function that
  needs two is two operations, and the second one belongs in a job.
- MUST NOT call another service's repository. Cross-module reads go through
  that module's service.
- Cross-service calls go through a client in `packages/`, always with a
  timeout, and never inside an open database transaction.
- **Anything slow, external, or retryable is enqueued, not awaited**
  (ADR-007). Image processing and webhook delivery MUST be jobs.
- The authorization decision (may this caller do this to this row) lives
  here or in the repository's scoping -- never only in middleware. Middleware
  proves the caller has the permission in general; the service proves it for
  this row.
- Pure helpers used by one service live in the same file below a banner, or
  in `<module>.util.ts` if they are shared. Not exported unless tested
  directly.

---

## 9. Repository & Tenant Scoping Standards

This is the section that keeps the platform multi-tenant. Read
`docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md` and ADR-005 before
touching a repository.

### The `TenantContext`

```ts
// packages/tenancy/src/tenant-context.ts
export type TenantContext = {
  readonly tenantId: TenantId;
  readonly projectId: ProjectId;
  readonly applicationId: ApplicationId;
  readonly permissions: readonly Permission[];
  readonly requestId: string;
};
```

It is constructed **once**, by the authentication + tenant-context
middleware, from the verified credential -- never from user-supplied input.
It is passed explicitly down the call chain.

### Template

```ts
// asset.repository.ts
import type { TenantContext } from "@image-delivery/tenancy";
import { scoped, type Tx } from "@image-delivery/db";

import { toAssetDomain, toAssetRow } from "./asset.mapper.js";
import type { Asset, AssetId } from "./asset.types.js";

// ==========================================
// READ
// ==========================================

export const findById = async (
  ctx: TenantContext,
  assetId: AssetId,
  tx?: Tx,
): Promise<Asset | null> => {
  const row = await scoped(ctx, "assets", tx)
    .where({ id: assetId, deleted_at: null })
    .first();

  return row ? toAssetDomain(row) : null;
};

export const listByProject = async (
  ctx: TenantContext,
  filter: ListAssetsFilter,
  tx?: Tx,
): Promise<readonly Asset[]> => {
  const rows = await scoped(ctx, "assets", tx)
    .where({ deleted_at: null })
    .modify(applyAssetFilter, filter)
    .orderBy(filter.sortColumn, filter.sortDirection)
    .limit(filter.limit);

  return rows.map(toAssetDomain);
};
```

`scoped(ctx, table, tx)` is the only sanctioned entry point to the query
layer for tenant-owned tables. It injects
`where tenant_id = ctx.tenantId and project_id = ctx.projectId` by
construction, so a forgotten `where` clause is not expressible.

### Rules

- **Every repository function takes `ctx: TenantContext` first.** MUST.
- **Every query against a tenant-owned table goes through `scoped()`.** MUST.
  A raw query builder or raw SQL touching such a table outside
  `packages/db` is a review-blocking finding, not a style preference
  (ADR-005).
- A repository returns domain types via a mapper, never raw rows. A raw row
  leaking upward means `snake_case` DB names spread into services, and a
  column rename becomes a cross-layer refactor.
- A repository MUST NOT: contain business rules, throw HTTP-shaped errors,
  call another repository, enqueue jobs, or open its own transaction. It
  accepts an optional `tx` and uses it when given.
- `find*` returns `T | null`. It never throws `NotFoundError` -- "absent" is
  a fact, "404" is a decision, and the decision belongs to the service.
- Cross-tenant reads (admin tooling, the tenant-provisioning path) use an
  explicitly named escape hatch -- `unsafeUnscoped(reason)` -- which logs the
  reason at `warn`, is banned in `services/*` by lint, and exists only in
  `services/admin`-style contexts with a test proving the permission gate.
- Soft deletes: every read filters `deleted_at: null` explicitly. There is
  no global default filter, because a default no one sees is a default no
  one checks.
- Pagination is cursor-based on the ULID primary key (ADR-003), never
  `OFFSET` on a large table. See `docs/API/07-PAGINATION.md`.

### What a cross-tenant test looks like

Required by `TASKS/00-TASK-CONVENTIONS.md` for every `:id` route:

```ts
it("returns 404 when the asset belongs to another tenant", async () => {
  const other = await factories.asset({ tenantId: tenantB.id });

  const res = await client.as(tenantA).get(`/v1/assets/${other.id}`);

  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe("asset_not_found");
});
```

`403` is acceptable where the specification says so; `200` never is, and a
body that distinguishes "exists but forbidden" from "does not exist" for a
foreign id is itself the leak.

---

## 10. Storage Adapter Standards

ADR-001: consumers never learn what storage sits underneath, and that is
only true if it is true in the code from day one.

### The interface

```ts
// packages/storage-adapter/src/storage-adapter.ts
export interface StorageAdapter {
  put(key: ObjectKey, body: Readable | Buffer, opts: PutOptions): Promise<PutResult>;
  get(key: ObjectKey): Promise<GetResult>;
  delete(key: ObjectKey): Promise<void>;
  exists(key: ObjectKey): Promise<boolean>;
  presignPut(key: ObjectKey, opts: PresignOptions): Promise<PresignedUrl>;
  presignGet(key: ObjectKey, opts: PresignOptions): Promise<PresignedUrl>;
  list(prefix: ObjectKeyPrefix, opts: ListOptions): Promise<ListResult>;
}
```

### Rules

- No package or service outside `packages/storage-adapter` may import
  `@aws-sdk/*` or any other provider SDK. Enforced by lint.
- A provider-specific error MUST be translated into a `StorageError`
  subclass at the adapter boundary. A raw `NoSuchKey` reaching a service
  means the abstraction has already leaked.
- Every adapter passes the shared conformance suite
  (`storage-adapter.conformance.test.ts`, `P0-07`) **unmodified**. If a
  provider cannot satisfy a case, the interface contract changes and every
  adapter is updated -- the suite is not weakened for one provider.
- Object keys are produced only by the object-naming function specified in
  `docs/STORAGE/04-OBJECT-NAMING.md`, which takes `params_hash` from
  `packages/transform-params` (ADR-004/009). String-concatenating an object
  key anywhere else is a review-blocking finding.
- Presigned URL TTLs come from config, are bounded by a constant, and are
  never logged in full.
- Streams, not buffers, for original bytes. A service that reads an entire
  upload into memory fails on the first large TIFF.

---

## 11. Transformation Parameter Standards

The single highest-risk cross-cutting function in the codebase (ADR-004,
ADR-009). `/image/abc?w=400&h=300` and `?h=300&w=400` are one derivative,
one cache key, one stored object -- and that is only true because exactly
one function decides it.

### Rules

- `packages/transform-params` owns three things and is the only place they
  exist:
  1. the **parameter registry** -- each parameter's canonical name, aliases,
     type, bounds, and default;
  2. `normalizeTransformParams()` -- alias resolution, type coercion,
     default application, ordering;
  3. `computeParamsHash()` -- the hash over the normalized form.
- The CDN cache key (`docs/CDN/01-CACHE-KEY.md`), the derivative object key
  (`docs/STORAGE/04-OBJECT-NAMING.md`), and `derivative_id`
  (`docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`) MUST all derive
  from the same returned `params_hash`. Not "produce the same value" --
  *call the same function*.
- Adding a parameter: registry + normalizer + golden vectors + the protocol
  document + the pipeline step, in one change. The pipeline step goes at the
  position `docs/IMAGE-DELIVERY-PROTOCOL/16-TRANSFORMATION-PIPELINE.md`
  fixes; pipeline order is part of the contract, not an implementation
  detail.
- **Changing an existing parameter's normalization or the hash algorithm
  requires an ADR before the first line of code.** It invalidates every
  cache entry and every stored derivative key in existence.
- The golden test-vector fixture is append-only. A changed expected hash in
  a diff is a released-contract break and must be called out in review, not
  re-recorded to make the suite pass.
- The normalizer is pure and synchronous: no I/O, no clock, no randomness,
  no config reads. It must produce identical output in the API, a worker, a
  CDN edge function, and every SDK's test-vector run.

---

## 12. Error Handling

### The hierarchy

```ts
// packages/errors/src/app-error.ts
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];
  readonly expose: boolean = true; // may the message reach the client?

  constructor(code: ErrorCode, opts: AppErrorOptions = {}) { ... }
}

export class BadRequestError extends AppError { readonly status = 400; }
export class UnauthorizedError extends AppError { readonly status = 401; }
export class ForbiddenError extends AppError { readonly status = 403; }
export class NotFoundError extends AppError { readonly status = 404; }
export class ConflictError extends AppError { readonly status = 409; }
export class PayloadTooLargeError extends AppError { readonly status = 413; }
export class UnsupportedMediaTypeError extends AppError { readonly status = 415; }
export class UnprocessableError extends AppError { readonly status = 422; }
export class QuotaExceededError extends AppError { readonly status = 429; }
export class RateLimitedError extends AppError { readonly status = 429; }
export class InternalError extends AppError { readonly status = 500; expose = false; }
export class UpstreamError extends AppError { readonly status = 502; expose = false; }
```

### The error code registry

```ts
// packages/errors/src/error-codes.ts
export const ERROR_CODES = {
  // 400
  INVALID_ID: "invalid_id",
  INVALID_TRANSFORM_PARAM: "invalid_transform_param",
  // 401 / 403
  API_KEY_MISSING: "api_key_missing",
  API_KEY_INVALID: "api_key_invalid",
  SIGNATURE_INVALID: "signature_invalid",
  SIGNATURE_EXPIRED: "signature_expired",
  PERMISSION_DENIED: "permission_denied",
  // 404
  ASSET_NOT_FOUND: "asset_not_found",
  FOLDER_NOT_FOUND: "folder_not_found",
  DERIVATIVE_NOT_FOUND: "derivative_not_found",
  // 409 / 413 / 415 / 422
  IDEMPOTENCY_KEY_REUSED: "idempotency_key_reused",
  UPLOAD_TOO_LARGE: "upload_too_large",
  UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
  IMAGE_DECODE_FAILED: "image_decode_failed",
  // 429
  QUOTA_EXCEEDED: "quota_exceeded",
  RATE_LIMITED: "rate_limited",
  // 5xx
  INTERNAL: "internal_error",
  STORAGE_UNAVAILABLE: "storage_unavailable",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

### Rules

- MUST NOT `throw new Error("...")` in application code. Throw an
  `AppError` subclass with a code from the registry.
- MUST NOT throw a string, a plain object, or a `{ status, message }`
  literal.
- A code, once released, MUST NOT change meaning -- clients branch on it.
  Adding a code is cheap; repurposing one is a breaking change.
- `expose: false` errors (5xx, upstream failures) return a generic message.
  The real cause goes to the log with the `request_id`, never to the client.
  Provider-specific text in a client-visible message is an information leak.
- Error messages are human-readable, actionable, and mention no secret, no
  internal hostname, no SQL, and no stack.
- **"Not found" is the preferred answer for a foreign-tenant resource** --
  `403` tells an attacker the id exists
  (`docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`).
- One central error middleware maps `AppError -> HTTP`, logs, and emits the
  envelope. It is the only place that knows about status codes besides the
  error classes themselves. An unknown error type maps to `500` +
  `internal_error` and is logged at `error` with the stack.
- Retryability is explicit: an error carries `retryable: boolean` so job
  handlers and SDKs do not guess from the status code.

### Status code table

| Status | When | Example code |
|---|---|---|
| 400 | Malformed syntax, unparseable params | `invalid_transform_param` |
| 401 | Missing/invalid credential | `api_key_invalid` |
| 403 | Authenticated, lacks the permission (own-tenant resources only) | `permission_denied` |
| 404 | Absent **or** owned by another tenant | `asset_not_found` |
| 409 | State conflict, idempotency-key reuse with a different body | `idempotency_key_reused` |
| 413 | Upload exceeds the limit | `upload_too_large` |
| 415 | Unsupported input format | `unsupported_media_type` |
| 422 | Well-formed but semantically impossible | `image_decode_failed` |
| 429 | Rate limit or quota | `rate_limited`, `quota_exceeded` |
| 500 | Unexpected failure | `internal_error` |
| 502/503 | Storage/CDN/upstream failure | `storage_unavailable` |

---

## 13. Response Format

> The normative wire contract is `docs/API/01-API-STANDARDS.md` and
> `docs/API/05-ERROR-HANDLING.md`. What follows is the code-side pattern; it
> is ratified into those documents by `P0-09`.

### Success

```json
{
  "data": { "id": "01JABCD...", "content_type": "image/jpeg", "created_at": "2026-09-18T04:21:07Z" },
  "meta": { "request_id": "01JREQ..." }
}
```

Collection:

```json
{
  "data": [{ "id": "01JABCD..." }],
  "meta": { "request_id": "01JREQ...", "next_cursor": "01JABCE...", "has_more": true }
}
```

### Error

```json
{
  "error": {
    "code": "invalid_transform_param",
    "message": "Parameter 'w' must be an integer between 1 and 8192.",
    "details": [{ "field": "w", "reason": "out_of_range" }],
    "request_id": "01JREQ..."
  }
}
```

### Rules

- Success bodies always nest under `data`; a bare array or scalar at the top
  level is not returned (it leaves no room to add `meta` without breaking
  clients).
- Errors always nest under `error`, and an error response never also carries
  `data`.
- Field names are `snake_case`. Timestamps are RFC 3339 UTC with a `Z`
  suffix, second precision unless the field documents otherwise.
- `null` means "known to be empty". An absent field means "not applicable or
  not requested". These are not interchangeable, and
  `exactOptionalPropertyTypes` keeps the code honest about which is which.
- Every response carries `request_id`, echoed in the `X-Request-Id` header
  and present in every log line for that request.
- The delivery endpoint is the exception to all of the above: it returns
  **image bytes** with HTTP headers as its contract, per
  `docs/IMAGE-DELIVERY-PROTOCOL/25-IMAGE-HEAD-REQUEST.md` through `29-ETAG-AND-CONDITIONAL-REQUESTS.md`. It does not wrap anything in
  `data`. An error on the delivery path follows that category's rules for
  content negotiation.
- Envelopes are constructed only by `ok()` / `created()` / `noContent()` /
  the error middleware.

---

## 14. Authorization & Permission Format

### Permission string format

```
<resource>:<action>              asset:read
<resource>:<scope>:<action>      asset:project:delete
```

Actions: `create`, `read`, `update`, `delete`, `list`, plus domain actions
(`transform`, `purge`, `sign`). Scopes narrow the reach: `self`, `project`,
`tenant`.

```ts
export const PERMISSIONS = {
  ASSET_CREATE: "asset:create",
  ASSET_READ: "asset:read",
  ASSET_DELETE: "asset:delete",
  ASSET_PURGE: "asset:tenant:purge",
  DERIVATIVE_TRANSFORM: "derivative:transform",
  SIGNED_URL_SIGN: "signed-url:sign",
  WEBHOOK_MANAGE: "webhook:update",
  ADMIN_TENANT_READ: "admin:tenant:read",
} as const;
```

### Rules

- Permission strings live only in `PERMISSIONS`. A literal
  `"asset:read"` in a route file is a typo waiting to grant nothing (or
  everything).
- `requirePermission` is a **coarse** gate: does this credential hold this
  permission at all. It is never the whole check. The row-level check
  (does this asset belong to this caller's project) is the repository's
  scoping plus the service's decision. Both, always -- ADR-005 exists
  because either one alone is one bug from a leak.
- An API key's permissions are resolved from the credential at
  authentication time into `ctx.permissions`, and are immutable for the
  request.
- Escalation paths (admin endpoints, `unsafeUnscoped`) require an explicit
  permission, an audit log entry (`docs/SECURITY/`), and a test proving a
  non-admin caller is rejected.
- Adding a permission means: the constant, the roles that receive it, the
  seed, `docs/API/03-AUTHORIZATION.md`, and a test for the deny path. The
  deny-path test is the one that matters.

---

## 15. Database Standards

### Schema rules

- Table names `snake_case` plural; column names `snake_case`.
- Every tenant-owned table carries `tenant_id` **and** `project_id`, both
  `not null`, both indexed as the leading columns of the composite indexes
  that serve its queries. This is what makes `scoped()` cheap as well as
  correct.
- Primary keys are ULIDs stored as `char(26)` (or the type `P0-06` records),
  never auto-increment integers (ADR-003).
- Timestamps: `created_at`, `updated_at`, `deleted_at`, all
  `timestamptz`, all UTC. Soft delete via `deleted_at`.
- Money/size/count columns are integers in an explicit unit named in the
  column: `byte_size`, `width_px`, `ttl_seconds`.
- Enum-like columns are `text` + a `check` constraint, not a Postgres enum
  type -- adding a value should not need an exclusive lock.
- Foreign keys are declared, with an explicit `on delete` policy chosen per
  relationship (`restrict` by default; `cascade` only where the child has no
  independent lifecycle).
- Every uniqueness rule that matters is a database constraint, not only an
  application check. An idempotency key is unique per
  `(tenant_id, project_id, key)` in the schema.

### Query rules

- Every query on a tenant-owned table goes through `scoped()` (section 9).
- No `SELECT *`. Name the columns, so a column addition cannot change a
  result shape silently.
- No N+1: batch with a single `where id in (...)`, or a join. A loop
  containing `await repository.findById` is a review finding.
- No `OFFSET` pagination on tenant data -- cursor on the ULID PK.
- A transaction holds no network call to a third party (storage, CDN,
  webhook) inside it. Do the database work, commit, then enqueue.
- Long-running reports and analytical scans go to a read replica or a queue,
  never to the request path.

### Index guidelines

- Add an index with the query it serves named in the migration comment. An
  index with no named query is either dead or a guess.
- Composite index column order follows the query's equality-then-range
  shape: `(tenant_id, project_id, created_at desc)` serves the default
  asset listing.
- Unique index on `(tenant_id, project_id, params_hash, asset_version_id)`
  for derivatives -- the database is the last line of defence against a
  duplicate derivative even if the hash function were called twice.
- Every new index's effect is measured with `EXPLAIN (ANALYZE, BUFFERS)`
  on realistic row counts, and the plan goes in the task's `MEMORY/` record.

---

## 16. Caching Standards

### Key format

```
img:v1:<tenant_id>:<entity>:<identifier>[:<discriminator>]
```

| Purpose | Key | TTL |
|---|---|---|
| Asset metadata | `img:v1:<tenant>:asset:<asset_id>` | 5 min |
| Derivative lookup | `img:v1:<tenant>:derivative:<params_hash>` | 1 h |
| API key resolution | `img:v1:<tenant>:apikey:<key_hash>` | 5 min |
| Quota counter | `img:v1:<tenant>:quota:<period>` | period end |
| Rate limit window | `img:v1:<tenant>:ratelimit:<app_id>:<window>` | window |
| Idempotency record | `img:v1:<tenant>:idem:<key>` | 24 h |

### Rules

- The `v1:` segment is a **global cache version**. A change in the cached
  value's shape bumps it; it is never "just deploy and let the old entries
  age out".
- The tenant id is in every key. A cache key that omits it is a cross-tenant
  leak with extra steps -- and one that is invisible to every IDOR test that
  only exercises the database path.
- Keys are built only by `cacheKey()` helpers in `packages/db` (or the cache
  package), never by template-literal concatenation at a call site.
- Every `set` names an explicit TTL. An unbounded key is a memory leak with
  a stale-data bug attached.
- A cache miss is always correct: the code path that reads through to the
  source must be exercised by a test with the cache disabled.
- Invalidation is explicit and happens **after** the transaction commits,
  in the same service function that wrote the data. A background sweeper is
  a safety net, never the primary mechanism.
- Cached values are validated on read with the same Zod schema used to write
  them. An old-shaped entry after a deploy is a routine event, not an
  exception.
- The CDN cache key is a different thing entirely: it is defined by
  `docs/CDN/01-CACHE-KEY.md` and derived from `params_hash`. Do not conflate
  the application cache with the edge cache.

---

## 17. Queue & Worker Standards

ADR-007: image processing and webhook delivery never run on the request
path.

### Queues

| Queue | Consumes | Notes |
|---|---|---|
| `image-processing` | `generate-derivative`, `extract-metadata` | CPU-bound, concurrency tuned to cores |
| `webhook-delivery` | `deliver-webhook` | third-party latency, aggressive backoff |
| `maintenance` | `sweep-orphans`, `recompute-usage` | scheduled |

### Job template

```ts
// jobs/generate-derivative.job.ts
import { z } from "zod";

export const GENERATE_DERIVATIVE = "generate-derivative" as const;

export const generateDerivativePayloadSchema = z.object({
  tenantId: z.string(),
  projectId: z.string(),
  assetId: z.string(),
  assetVersionId: z.string(),
  paramsHash: z.string(),
  requestId: z.string(),
}).strict();

export type GenerateDerivativePayload = z.infer<typeof generateDerivativePayloadSchema>;

export const enqueueGenerateDerivative = async (
  payload: GenerateDerivativePayload,
): Promise<void> => {
  await imageProcessingQueue.add(GENERATE_DERIVATIVE, payload, {
    jobId: `${payload.assetVersionId}:${payload.paramsHash}`, // idempotency
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: 3_600 },
    removeOnFail: false, // keep for the DLQ inspection path
  });
};

export const handleGenerateDerivative = async (job: Job): Promise<void> => {
  const payload = generateDerivativePayloadSchema.parse(job.data);
  const ctx = tenantContextFromJob(payload);

  await withJobLogger(payload, async () => {
    const existing = await derivativeRepository.findByParamsHash(ctx, payload.paramsHash);
    if (existing) return; // redelivery -- nothing to do

    await derivativeService.generate(ctx, payload);
  });
};
```

### Rules

- Every job payload has a Zod schema and is parsed at the top of the
  handler. A job is untrusted input: it may have been enqueued by an older
  deploy.
- **Every handler is idempotent.** At-least-once delivery is the contract, so
  a redelivery must be a no-op. The `jobId` derived from the natural key
  (`assetVersionId:paramsHash`) is the first line of defence; the existence
  check in the handler is the second.
- The payload carries ids, never whole objects and never image bytes. Bytes
  live in storage; the job carries the key.
- The payload carries the tenant and project ids so the worker can build a
  `TenantContext`. A worker MUST NOT use an unscoped repository because "it
  is internal" -- the scoping rules are identical in workers.
- Every job carries the originating `requestId` and logs with it, so a
  request can be traced from the API through to the derivative.
- `attempts` and `backoff` are explicit per job type. Failures land in the
  DLQ with the payload retained (`removeOnFail: false`); the sweeper and
  dead-letter handling are `P6-04`.
- Concurrency and rate limits are configuration, not code constants.
- Graceful shutdown: on `SIGTERM`, stop accepting, finish in-flight, close
  the connection. A killed worker mid-job must be safe precisely because
  the handler is idempotent.

---

## 18. Logging & Observability Standards

### Rules

- One logger, from `packages/logger`. `console.log` is banned by lint in
  `services/*` and `packages/*`.
- Structured JSON only. The message is a short, stable, lowercase string;
  everything variable is a field. `logger.info({ asset_id }, "asset created")`,
  never `logger.info(\`created asset ${id}\`)` -- a templated message cannot
  be aggregated.
- Field names are `snake_case` and match the API/DB name for the same
  concept: `asset_id`, `tenant_id`, `params_hash`, `request_id`.
- Every log line inside a request carries `request_id`, `tenant_id`,
  `project_id`, and `route`. The logging middleware attaches them; a service
  does not re-add them.
- **Never logged, at any level:** API keys (raw or partial), signed-URL
  signatures, HMAC secrets, `Authorization` headers, presigned URLs with
  their query strings, raw image bytes, or personal data beyond what
  `docs/SECURITY/` permits. The redaction list in `packages/logger` is
  enforced by a test that asserts a known secret does not appear in the
  serialized output.
- Levels: `error` (a human must look), `warn` (degraded, self-healing),
  `info` (state change worth an audit trail), `debug` (development only,
  off in production).
- An error log includes the stack and the `AppError` code. A caught-and-
  handled expected condition is `warn` at most -- logging every 404 at
  `error` trains everyone to ignore the error log.
- Metrics and traces follow `docs/OBSERVABILITY/`; span names match route
  names, and every cross-service call is a span.

More: [`12-LOGGING-CONVENTIONS.md`](./12-LOGGING-CONVENTIONS.md).

---

## 19. Configuration & Environment Variables

### Rules

- **`process.env` is read in exactly one place per service:**
  `packages/config`, at startup, through a Zod schema. Everything else
  receives a typed config object.
- The process exits non-zero at startup on an invalid or missing variable.
  A service that boots and fails on the first request instead is harder to
  diagnose and may pass a health check.
- `.env.example` lists every variable with a comment and a safe default or a
  placeholder. A new variable without an `.env.example` entry does not
  merge.
- No secret in the repository, in a default value, or in a log. Secret
  delivery follows `docs/DEVOPS/04-SECRETS-MANAGEMENT.md`.
- Variables are prefixed by domain and named for what they are, with units
  in the name where applicable.

### Variable naming

```bash
# App
NODE_ENV=development
SERVICE_NAME=api
PORT=3000
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=image_delivery
DB_USER=image_delivery
DB_PASSWORD=
DB_POOL_MAX=10
DB_STATEMENT_TIMEOUT_MS=5000

# Redis
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=img:v1

# Storage (S3-compatible: AWS S3, Cloudflare R2, MinIO -- ADR-002)
STORAGE_PROVIDER=s3
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_REGION=us-east-1
STORAGE_S3_BUCKET=image-delivery-dev
STORAGE_S3_ACCESS_KEY_ID=
STORAGE_S3_SECRET_ACCESS_KEY=
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_PRESIGN_MAX_TTL_SECONDS=900

# Delivery / CDN
CDN_BASE_URL=http://localhost:3000
DELIVERY_SIGNING_SECRET=
DELIVERY_SIGNED_URL_MAX_TTL_SECONDS=3600

# Queue
QUEUE_IMAGE_PROCESSING_CONCURRENCY=4
QUEUE_WEBHOOK_CONCURRENCY=8

# Limits
UPLOAD_MAX_BYTES=26214400
TRANSFORM_MAX_DIMENSION_PX=8192

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=api
```

### Config template

```ts
// packages/config/src/config.ts
const configSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]),
  port: z.coerce.number().int().positive(),
  db: z.object({
    host: z.string().min(1),
    port: z.coerce.number().int().positive(),
    poolMax: z.coerce.number().int().min(1).max(100).default(10),
  }),
  storage: z.object({
    provider: z.enum(["s3", "local"]),
    presignMaxTtlSeconds: z.coerce.number().int().min(1).max(604_800),
  }),
});

export type Config = z.infer<typeof configSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = configSchema.safeParse(mapEnv(env));
  if (!parsed.success) {
    // Field names only -- never the values, which may be secrets.
    throw new Error(`invalid configuration: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
};
```

---

## 20. Constants Standards

### Structure

```
packages/schema/src/constants/          # shared across services
├── index.ts
├── asset.constants.ts
├── transform.constants.ts
├── permissions.constants.ts
└── cache.constants.ts

services/<service>/src/constants/       # service-local only
```

### Template

```ts
// asset.constants.ts

// ==========================================
// LIMITS
// ==========================================

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB -- PLAN/15-QUOTA-LIMITS.md
export const MAX_TAGS_PER_ASSET = 50;
export const MAX_FILENAME_LENGTH = 255;

// ==========================================
// STATUS
// ==========================================

export const ASSET_STATUS = {
  PENDING: "pending",
  READY: "ready",
  FAILED: "failed",
  DELETED: "deleted",
} as const;

export type AssetStatus = (typeof ASSET_STATUS)[keyof typeof ASSET_STATUS];

// ==========================================
// SUPPORTED FORMATS
// ==========================================

export const SUPPORTED_INPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
] as const;
```

### Rules

- A magic number or string literal appearing twice becomes a constant. Once
  is allowed only inside the function that owns it.
- `as const` on every enum-like object; derive the type from it rather than
  declaring it twice.
- Never a TypeScript `enum` -- it emits runtime code and behaves unlike the
  rest of the type system.
- A constant that corresponds to a specification value carries a comment
  naming the document (`// PLAN/15-QUOTA-LIMITS.md`). When the spec changes,
  the reader can find the value; when the value changes, the reviewer can
  find the spec.
- Values that differ per environment are **configuration**, not constants.
  If it must change without a deploy, it is not a constant.
- Constants are grouped under banners by concern, one concern per file.

---

## 21. Migration & Seeding Standards

The concrete tool is chosen in `P0-06`; these rules hold regardless.

### Migration rules

- One migration per change, named
  `<timestamp>_<verb>_<subject>.ts`:
  `20260918T041500_add_derivatives_params_hash_index.ts`.
- Migrations are **forward-only and additive** in production. To remove a
  column: stop writing it, deploy; stop reading it, deploy; drop it in a
  later migration. Three deploys, zero downtime.
- Every migration is reversible in development (`down` implemented) even
  though production rolls forward. Rollback strategy:
  `docs/DEVOPS/10-ROLLBACK.md`.
- A migration MUST NOT be edited after it has run anywhere but a local
  machine. Fix it with a new migration.
- Index creation on a populated table uses `CREATE INDEX CONCURRENTLY` in
  its own migration (no transaction), never inside a mixed one.
- A migration touching more than ~100k rows is a batched backfill job, not
  a migration -- a migration that holds a lock for minutes is an outage.
- Data backfills are separate from schema changes, idempotent, resumable,
  and logged.
- Every migration is tested by running it against a Testcontainers Postgres
  in CI, from an empty database and from the previous release's schema.

### Seeding rules

- Seeds are split: **reference data** (permissions, roles, supported
  formats) runs in every environment and is idempotent (upsert by natural
  key); **development fixtures** (sample tenants, assets) run only when
  `NODE_ENV=development`.
- A seed MUST be safe to run twice. A seed that inserts duplicates on a
  second run will eventually run twice.
- Seed order is explicit and declared, not implied by filename luck:
  tenants -> projects -> applications -> api keys -> assets.
- Seeds never contain a real credential. Development API keys are generated
  at seed time and printed once.
- A new permission constant means a new reference-data seed entry, in the
  same change (section 14).

---

## 22. Testing Standards

`docs/TESTING/00-TEST-STRATEGY.md` decides **what** is tested at which
layer. This section covers how the files look.

### Framework and layout

| Kind | Location | Pattern | Runs against |
|---|---|---|---|
| Unit | beside the source | `*.test.ts` | nothing external, dependencies stubbed |
| Integration | `tests/integration/` | `*.int.test.ts` | Testcontainers: Postgres, Redis, MinIO |
| API contract | `tests/integration/` | `*-api.int.test.ts` | the service over HTTP |
| Conformance | `packages/*/tests/` | `*.conformance.test.ts` | every adapter implementation |
| Golden vector | `packages/transform-params/tests/` | `*.vectors.test.ts` | the committed fixture |
| E2E | `tests/e2e/` | `*.e2e.test.ts` | docker-compose stack |
| Load | `tests/load/` | k6/artillery scripts | a deployed environment |

### Naming

```ts
describe("AssetService.createAsset", () => {
  it("creates an asset in the caller's project", async () => {});
  it("rejects an upload larger than MAX_UPLOAD_BYTES", async () => {});
  it("returns the existing asset when the idempotency key is reused", async () => {});
  it("throws NotFoundError when the folder belongs to another tenant", async () => {});
});
```

- `describe` names the unit under test: `Class.method`, `functionName`, or
  `METHOD /path`.
- `it` states the behavior and the condition, in the present tense, from the
  caller's point of view. Never `it("works")`, never `it("test 1")`.
- One assertion subject per test. A test asserting five unrelated things
  reports one failure for five bugs.

### Structure

Arrange / Act / Assert, separated by blank lines, in that order. No
assertion in the arrange block; no logic in the assert block.

### Rules

- Tests are independent and order-independent. No shared mutable state, no
  "this test must run after that one". Each integration test creates its own
  tenant via a factory.
- Fixtures come from typed factories in `packages/test-utils`:
  `factories.asset({ tenantId })`, with sensible defaults and explicit
  overrides. No hand-built object literals repeated across files.
- Stub at the boundary, not in the middle. A service test stubs the
  repository; it does not stub another function inside the same service.
- Never stub the thing under test. Never stub `normalizeTransformParams` or
  `computeParamsHash` -- their whole value is that they are the real one
  (ADR-004).
- Time and randomness are injected (a `clock` and an `idGenerator`), never
  read from the global in code under test.
- **Required tests, per `TASKS/00-TASK-CONVENTIONS.md` and the spec:**
  1. every `:id` route -- the cross-tenant `404` test (section 9);
  2. every job handler -- an idempotent-redelivery test;
  3. every storage adapter -- the unmodified conformance suite;
  4. every transformation parameter -- golden vectors, with existing
     vectors' hashes unchanged;
  5. every signed-URL code path -- invalid signature, expired signature,
     tampered parameter, and constant-time comparison;
  6. every permission -- the **deny** path, not only the allow path.
- Coverage: 90% lines in `packages/*` (they are libraries with no excuse),
  80% in `services/*`, and **100% of branches** in
  `packages/transform-params`, `packages/errors`, and every authorization
  and signature-verification function. Coverage thresholds are a CI gate.
- Coverage is a floor, not a goal. A test that asserts nothing meaningful to
  raise a number is worse than no test, because it makes the number lie.
- Tests assert on public behavior and error codes, not on log output or
  internal call counts, except where the log line *is* the requirement
  (audit entries, redaction).

More: [`09-TESTING-CONVENTIONS.md`](./09-TESTING-CONVENTIONS.md).

---

## 23. Tooling, Lint & Format

### The commands, identical locally and in CI

```bash
pnpm install --frozen-lockfile
pnpm lint          # eslint, zero warnings allowed
pnpm typecheck     # tsc --noEmit across the workspace
pnpm test          # vitest, unit + integration
pnpm test:coverage # with thresholds enforced
pnpm build         # tsc build / bundler per package
pnpm deps:check    # dependency-cruiser boundary rules
pnpm audit         # dependency vulnerabilities (P0-10)
```

`pnpm lint && pnpm typecheck && pnpm test` passing is the baseline
Definition of Done for every task
(`TASKS/00-TASK-CONVENTIONS.md`). "Zero new warnings" is literal: warnings
are errors in CI.

### Lint rules that encode the architecture

These are not style preferences -- each one prevents a specific failure this
specification cares about:

| Rule | Prevents |
|---|---|
| `no-restricted-imports`: `**/*.repository` and `@image-delivery/db` from `**/*.controller.ts` | Controllers bypassing the service layer and its authorization decisions |
| `no-restricted-imports`: HTTP framework types from `**/*.service.ts` | Services that cannot be reused by a worker |
| `no-restricted-imports`: `@aws-sdk/*` outside `packages/storage-adapter` | The storage abstraction leaking (ADR-001) |
| `no-restricted-imports`: `node:crypto` hashing outside `packages/transform-params` for param hashing | A second params-hash implementation (ADR-004) |
| `no-restricted-syntax`: `console.*` in `services/**`, `packages/**` | Unstructured, unredacted log output |
| `@typescript-eslint/no-explicit-any` (error) | Untyped boundaries |
| `@typescript-eslint/no-floating-promises` (error) | Silently dropped async work, notably job enqueues |
| `@typescript-eslint/no-misused-promises` (error) | `async` handlers whose rejections vanish |
| `@typescript-eslint/consistent-type-imports` | Runtime imports of type-only modules |
| `import/no-default-export` | Inconsistent import names across the tree |
| `eslint-plugin-boundaries` service/package layering | One service importing another's internals |

Plus `dependency-cruiser` in CI for: no cycles, no `services/*` to
`services/*` edges, and no `packages/*` to `services/*` edges.

### Formatting

- Prettier owns all formatting; nobody argues about it in review. 2-space
  indent, double quotes, semicolons, trailing commas, 100-column print
  width.
- Format and lint run on staged files via a pre-commit hook, and again in
  CI. The hook is a convenience; CI is the gate.

More: [`10-TOOLING-LINT-FORMAT.md`](./10-TOOLING-LINT-FORMAT.md).

---

## 24. Git, Review & Deployment

`TASKS/00-TASK-CONVENTIONS.md` is normative for branches, commits, and the
Definition of Done. The essentials, plus the code-review specifics:

### Branch and commit

- Branch: `feat/P{phase}-{seq}-kebab-summary` -- `feat/P2-07-presigned-upload`.
- Commit subject: `P{phase}-{seq}: <imperative summary>` --
  `P2-07: add presigned upload endpoint`.
- Body references the documents implemented:
  `Implements docs/API/11-UPLOAD-API.md`.
- `main` stays free of in-progress work. Documentation-only fixes may go
  straight to `main`.

### Pull request

Every PR description states:

1. the task id and its `Implements:` documents;
2. the Definition of Done, checked off;
3. for a security-critical task, the location of the IDOR/BOLA test;
4. any deviation from the specification, and the `MEMORY/DECISIONS.md` entry
   that records it;
5. the `MEMORY/records/{TASK-ID}.md` file, in the same PR.

A PR that changes behavior without a `docs/` update, or closes a task
without its `MEMORY/` record, is not ready -- both are part of the
Definition of Done, not follow-up work.

### Review

The reviewer's blocking checklist is
[`14-CODE-REVIEW-CHECKLIST.md`](./14-CODE-REVIEW-CHECKLIST.md). The five
findings that block a merge outright:

1. a query on a tenant-owned table that does not go through `scoped()`;
2. an `:id` route with no cross-tenant test;
3. a second implementation of transformation-param normalization or hashing;
4. a secret, API key, or signature reachable from a log or a response;
5. a weakened `docs/SECURITY/` or `docs/MULTI-TENANCY/` control with an
   "I'll fix it later" note.

### Deployment

- Per `docs/DEVOPS/`. Every image is built once and promoted across
  environments; nothing is rebuilt per environment.
- Migrations run as a separate, explicit step before the new version serves
  traffic, and are compatible with the previous version (section 21's
  additive rule is what makes this possible).
- Local: `docker compose up` in `deploy/` brings up Postgres, Redis, and
  MinIO; `pnpm dev` runs the services.

---

## 25. Quick Reference

### The layer chain

```
routes -> controller -> service -> repository -> packages/db
          (HTTP only)   (domain)   (scoped)      (SQL)
```

### Every repository and service function

```ts
(ctx: TenantContext, ...rest) => Promise<T>
```

### Throwing

```ts
throw new NotFoundError(ERROR_CODES.ASSET_NOT_FOUND);
```

### Responding

```ts
ok(res, toAssetWire(asset));
created(res, toAssetWire(asset), { location: `/v1/assets/${asset.id}` });
```

### Logging

```ts
logger.info({ asset_id: asset.id, params_hash: hash }, "derivative generated");
```

### Cache key

```
img:v1:<tenant_id>:<entity>:<identifier>
```

### Enqueuing

```ts
await enqueueGenerateDerivative({ ...ids, requestId: ctx.requestId });
```

### Before opening a pull request

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm deps:check
```

- [ ] `docs/` file(s) updated (Draft specification -> Final, or open items noted)
- [ ] `MEMORY/records/{TASK-ID}.md` written
- [ ] `TASKS/PROGRESS.md` updated in the same change
- [ ] Cross-tenant `404` test present for every `:id` route touched
- [ ] No new dependency without an ADR

## Acceptance Criteria

- [x] Every default value is stated explicitly rather than left to library
      behavior -- limits, TTLs, statuses, coverage thresholds, and middleware
      order are all named here.
- [x] Every rule is either machine-enforced (lint, `dependency-cruiser`,
      coverage thresholds, CI) or explicitly marked as a review-time check
      in [`14-CODE-REVIEW-CHECKLIST.md`](./14-CODE-REVIEW-CHECKLIST.md).
- [x] Cross-references to `docs/API/`, `docs/SECURITY/`,
      `docs/MULTI-TENANCY/`, `docs/IMAGE-DELIVERY-PROTOCOL/`, and
      `MEMORY/DECISIONS.md` are present and correct.

## Open Questions

- Sections 5, 6, and 12 gain concrete framework types once `P0-08` picks the
  HTTP framework.
- Sections 9, 15, and 21 gain concrete query-layer syntax once `P0-06` picks
  Prisma, Drizzle, or Knex. The `scoped()` contract holds either way.
- The response envelope in section 13 is ratified into
  `docs/API/01-API-STANDARDS.md` by `P0-09`; until then that document is the
  normative home and this one is the code-side pattern.
- Coverage thresholds in section 22 are proposed; `docs/TESTING/00-TEST-STRATEGY.md`
  confirms them.

## Related Documents

- `docs/ENGINEERING/00-CODING-CONTEXT.md` (the one-page version of this file)
- `docs/ENGINEERING/README.md` (category index)
- `TASKS/00-TASK-CONVENTIONS.md` (branches, commits, Definition of Done)
- `docs/API/01-API-STANDARDS.md`, `docs/API/05-ERROR-HANDLING.md` (normative wire contract)
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`, `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/16-TRANSFORMATION-PIPELINE.md`, `17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `ADR-007`, `ADR-009`, `ADR-010`, `ADR-011`)
