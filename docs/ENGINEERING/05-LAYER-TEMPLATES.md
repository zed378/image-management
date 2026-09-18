# 05 - Layer Templates

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands sections 5-9 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

A copy-pasteable starting point for every file in a domain module, so a new
module is a mechanical exercise rather than a series of small invented
decisions. The worked example is `folder` -- a small, real module from
`docs/API/17-FOLDER-COLLECTION-API.md` -- shown as the complete vertical
slice.

HTTP framework types are written as `<http-framework>` until `P0-08` decides;
query-layer syntax is shown through `scoped()` and is independent of the
`P0-06` choice.

---

## The full slice, file by file

### `folder.types.ts`

```ts
import type { Brand } from "@image-delivery/tenancy";
import { BadRequestError, ERROR_CODES } from "@image-delivery/errors";
import { isUlid } from "@image-delivery/schema";

export type FolderId = Brand<string, "FolderId">;

export const toFolderId = (raw: string): FolderId => {
  if (!isUlid(raw)) throw new BadRequestError(ERROR_CODES.INVALID_ID);
  return raw as FolderId;
};

export type Folder = {
  readonly id: FolderId;
  readonly parentId: FolderId | null;
  readonly name: string;
  readonly path: string;
  readonly assetCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type FolderRow = {
  readonly id: string;
  readonly parent_id: string | null;
  readonly name: string;
  readonly path: string;
  readonly asset_count: number;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export type FolderWire = {
  readonly id: string;
  readonly parent_id: string | null;
  readonly name: string;
  readonly path: string;
  readonly asset_count: number;
  readonly created_at: string;
  readonly updated_at: string;
};
```

Three shapes, deliberately: the row is what the database has, the domain
type is what business rules operate on, and the wire type is the contract.
Collapsing them means a column rename is an API break.

### `folder.constants.ts`

```ts
export const MAX_FOLDER_NAME_LENGTH = 128;
export const MAX_FOLDER_DEPTH = 16; // PLAN/06-BUSINESS-RULES.md
export const FOLDER_NAME_PATTERN = /^[\w][\w .-]*$/u;
```

### `folder.schema.ts`

```ts
import { z } from "zod";

import { ulidSchema, paginationSchema } from "@image-delivery/schema";
import { FOLDER_NAME_PATTERN, MAX_FOLDER_NAME_LENGTH } from "./folder.constants.js";

export const folderIdParamSchema = z.object({ folderId: ulidSchema }).strict();

export const createFolderBodySchema = z
  .object({
    name: z.string().min(1).max(MAX_FOLDER_NAME_LENGTH).regex(FOLDER_NAME_PATTERN),
    parent_id: ulidSchema.nullable().default(null),
  })
  .strict();

export const listFoldersQuerySchema = paginationSchema
  .extend({ parent_id: ulidSchema.optional() })
  .strict();

export type CreateFolderBody = z.infer<typeof createFolderBodySchema>;
export type ListFoldersQuery = z.infer<typeof listFoldersQuerySchema>;
```

### `folder.mapper.ts`

```ts
import type { Folder, FolderRow, FolderWire } from "./folder.types.js";
import { toFolderId } from "./folder.types.js";

export const toFolderDomain = (row: FolderRow): Folder => ({
  id: toFolderId(row.id),
  parentId: row.parent_id === null ? null : toFolderId(row.parent_id),
  name: row.name,
  path: row.path,
  assetCount: row.asset_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toFolderWire = (folder: Folder): FolderWire => ({
  id: folder.id,
  parent_id: folder.parentId,
  name: folder.name,
  path: folder.path,
  asset_count: folder.assetCount,
  created_at: folder.createdAt.toISOString(),
  updated_at: folder.updatedAt.toISOString(),
});
```

Mappers are pure and get their own unit test. They are also where the
`snake_case` boundary lives, in one place per module.

### `folder.repository.ts`

```ts
import type { TenantContext } from "@image-delivery/tenancy";
import { scoped, type Tx } from "@image-delivery/db";

import { toFolderDomain } from "./folder.mapper.js";
import type { Folder, FolderId, FolderRow } from "./folder.types.js";

const COLUMNS = [
  "id", "parent_id", "name", "path", "asset_count", "created_at", "updated_at",
] as const;

// ==========================================
// READ
// ==========================================

export const findById = async (
  ctx: TenantContext,
  folderId: FolderId,
  tx?: Tx,
): Promise<Folder | null> => {
  const row = await scoped<FolderRow>(ctx, "folders", tx)
    .select(COLUMNS)
    .where({ id: folderId, deleted_at: null })
    .first();

  return row ? toFolderDomain(row) : null;
};

export const findByPath = async (
  ctx: TenantContext,
  path: string,
  tx?: Tx,
): Promise<Folder | null> => {
  const row = await scoped<FolderRow>(ctx, "folders", tx)
    .select(COLUMNS)
    .where({ path, deleted_at: null })
    .first();

  return row ? toFolderDomain(row) : null;
};

// ==========================================
// WRITE
// ==========================================

export const insertOne = async (
  ctx: TenantContext,
  input: { name: string; parentId: FolderId | null; path: string },
  tx: Tx,
): Promise<Folder> => {
  const [row] = await scoped<FolderRow>(ctx, "folders", tx)
    .insert({
      id: newUlid(),
      parent_id: input.parentId,
      name: input.name,
      path: input.path,
    })
    .returning(COLUMNS);

  return toFolderDomain(row);
};
```

Note what the repository does **not** do: no depth check, no name-collision
decision, no `NotFoundError`. Those are rules, and rules live in the
service.

### `folder.service.ts`

```ts
import type { TenantContext } from "@image-delivery/tenancy";
import { ConflictError, NotFoundError, UnprocessableError, ERROR_CODES } from "@image-delivery/errors";
import { logger } from "@image-delivery/logger";
import { withTransaction } from "@image-delivery/db";

import * as folderRepository from "./folder.repository.js";
import { MAX_FOLDER_DEPTH } from "./folder.constants.js";
import type { CreateFolderBody } from "./folder.schema.js";
import type { Folder, FolderId } from "./folder.types.js";

// ==========================================
// CREATE
// ==========================================

export const createFolder = async (
  ctx: TenantContext,
  input: CreateFolderBody,
): Promise<Folder> =>
  withTransaction(ctx, async (tx) => {
    const parent = input.parent_id
      ? await folderRepository.findById(ctx, toFolderId(input.parent_id), tx)
      : null;

    if (input.parent_id && !parent) {
      // Absent and foreign-tenant are indistinguishable by design:
      // docs/SECURITY/11-IDOR-BOLA-PREVENTION.md
      throw new NotFoundError(ERROR_CODES.FOLDER_NOT_FOUND);
    }

    const path = buildFolderPath(parent, input.name);

    if (depthOf(path) > MAX_FOLDER_DEPTH) {
      throw new UnprocessableError(ERROR_CODES.FOLDER_TOO_DEEP, {
        details: [{ field: "parent_id", reason: "max_depth_exceeded" }],
      });
    }

    const collision = await folderRepository.findByPath(ctx, path, tx);
    if (collision) throw new ConflictError(ERROR_CODES.FOLDER_ALREADY_EXISTS);

    const folder = await folderRepository.insertOne(
      ctx,
      { name: input.name, parentId: parent?.id ?? null, path },
      tx,
    );

    logger.info({ folder_id: folder.id, path }, "folder created");
    return folder;
  });

// ==========================================
// READ
// ==========================================

export const getFolder = async (ctx: TenantContext, folderId: FolderId): Promise<Folder> => {
  const folder = await folderRepository.findById(ctx, folderId);
  if (!folder) throw new NotFoundError(ERROR_CODES.FOLDER_NOT_FOUND);
  return folder;
};

// ==========================================
// PURE HELPERS
// ==========================================

const buildFolderPath = (parent: Folder | null, name: string): string =>
  parent ? `${parent.path}/${name}` : `/${name}`;

const depthOf = (path: string): number => path.split("/").filter(Boolean).length;
```

### `folder.controller.ts`

```ts
import type { RequestHandler } from "<http-framework>";

import { created, ok } from "@image-delivery/errors";

import * as folderService from "./folder.service.js";
import { toFolderWire } from "./folder.mapper.js";
import { createFolderBodySchema, folderIdParamSchema } from "./folder.schema.js";
import { toFolderId } from "./folder.types.js";

export const handleCreateFolder: RequestHandler = async (req, res) => {
  const body = createFolderBodySchema.parse(req.body);

  const folder = await folderService.createFolder(req.tenantContext, body);

  created(res, toFolderWire(folder), { location: `/v1/folders/${folder.id}` });
};

export const handleGetFolder: RequestHandler = async (req, res) => {
  const { folderId } = folderIdParamSchema.parse(req.params);

  const folder = await folderService.getFolder(req.tenantContext, toFolderId(folderId));

  ok(res, toFolderWire(folder));
};
```

### `folder.routes.ts`

```ts
import { Router } from "<http-framework>";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { PERMISSIONS } from "../../constants/permissions.constants.js";

import * as folderController from "./folder.controller.js";
import { createFolderBodySchema, folderIdParamSchema } from "./folder.schema.js";

export const folderRoutes = Router();

folderRoutes.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.FOLDER_CREATE),
  validate({ body: createFolderBodySchema }),
  folderController.handleCreateFolder,
);

folderRoutes.get(
  "/:folderId",
  authenticate,
  requirePermission(PERMISSIONS.FOLDER_READ),
  validate({ params: folderIdParamSchema }),
  folderController.handleGetFolder,
);
```

---

## Middleware template

```ts
// tenant-scope.middleware.ts
import type { RequestHandler } from "<http-framework>";

import { UnauthorizedError, ERROR_CODES } from "@image-delivery/errors";
import { buildTenantContext } from "@image-delivery/tenancy";

/**
 * Builds the request's TenantContext from the *verified credential only*.
 * Never from a header, query parameter, or body field the caller controls.
 */
export const tenantScope: RequestHandler = (req, _res, next) => {
  const credential = req.credential;
  if (!credential) throw new UnauthorizedError(ERROR_CODES.API_KEY_MISSING);

  req.tenantContext = buildTenantContext({
    tenantId: credential.tenantId,
    projectId: credential.projectId,
    applicationId: credential.applicationId,
    permissions: credential.permissions,
    requestId: req.requestId,
  });

  next();
};
```

Middleware rules:

- One concern per middleware. A middleware that authenticates *and* rate
  limits cannot be reordered or reused.
- Middleware throws `AppError`; it never writes an error response itself.
  The central error handler owns that.
- Middleware MUST NOT perform a database write. Reads are acceptable
  (credential resolution), cached per section 16.
- Order is fixed in `app.ts` and documented there; see section 5 of
  [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Job template

See section 17 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md) and
[`08-CACHE-QUEUE-STANDARDS.md`](./08-CACHE-QUEUE-STANDARDS.md).

## Checklist for a new module

- [ ] `docs/API/*.md` specifies the endpoints precisely (write it first if not)
- [ ] `*.types.ts` -- branded id + row/domain/wire triple
- [ ] `*.constants.ts` -- limits, each tracing to a `docs/` value
- [ ] `*.schema.ts` -- `.strict()` schemas, every string bounded
- [ ] `*.mapper.ts` -- pure, with its own test
- [ ] `*.repository.ts` -- `ctx` first, every query through `scoped()`
- [ ] `*.service.ts` -- rules, transactions, `AppError`s
- [ ] `*.controller.ts` -- parse, call, respond; no `try/catch`
- [ ] `*.routes.ts` -- fixed middleware order, explicit permission
- [ ] `*.service.test.ts` + `*.mapper.test.ts`
- [ ] `tests/integration/<module>-api.int.test.ts` with the cross-tenant 404
- [ ] Permission constants added, seeded, and deny-path tested
- [ ] `MEMORY/records/{TASK-ID}.md` + `TASKS/PROGRESS.md`

## Acceptance Criteria

- [x] A complete vertical slice is shown for one real module, not fragments.
- [x] Each template states what the layer must not do, not only what it does.
- [x] The row/domain/wire separation and the `ctx`-first rule appear in every
      template that they apply to.

## Open Questions

- `P0-08` replaces `<http-framework>` with concrete types, and fixes whether
  `validate` middleware plus an in-controller `parse` is redundant (the
  current rule keeps both: the middleware rejects early, the parse produces
  the typed value).
- `P0-06` fixes the query-builder syntax shown in the repository template.
  The `scoped(ctx, table, tx)` contract is what must survive that change.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (sections 5-9)
- `docs/ENGINEERING/07-REPOSITORY-DATABASE-STANDARDS.md`
- `docs/API/17-FOLDER-COLLECTION-API.md` (the module used as the example)
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`
