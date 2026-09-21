# 05 - Layer Templates

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v2 -- rewritten from the first real module, `P1-03`) &nbsp;|&nbsp; Owner: TBD

Expands sections 5-9 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

A copy-pasteable starting point for every file in a domain module, so a new
module is a mechanical exercise rather than a series of small invented
decisions. The worked example is **the real API-key module**
(`services/api/src/modules/api-keys/`), abridged here; the files are the
source of truth when the two differ. Version 1 of this document used an
invented folder module with placeholder framework types; it was replaced by
working code as promised in ADR-020.

---

## The files of a module

```
services/api/src/modules/api-keys/
  api-key.constants.ts       limits and defaults, each tracing to a doc
  api-key.types.ts           domain type, wire type (and the row type in the mapper)
  api-key.schema.ts          Zod request schemas: .strict(), every string bounded
  api-key.mapper.ts          row -> domain -> wire, pure
  api-key.repository.ts      queries, every one through scoped(); no rules
  api-key.service.ts         rules, transactions, AppErrors; no HTTP
  api-key.routes.ts          parse, call, respond; permission declared per route
  api-key.authentication.ts  the one exception: pre-tenant queries (unsafeUnscoped)
  *.test.ts                  unit tests beside the source
services/api/tests/
  api-keys.int.test.ts       service against a real database
  api-keys-http.int.test.ts  HTTP against a real database, incl. the cross-tenant 404s
```

Modules are **factories** that take their dependencies
(`createApiKeyService({ db, pepper, now })`), not singletons importing a
global database. That is what lets a test pass a clock or a stub, and what
lets the worker reuse a service with its own connection.

## Layer by layer

### `*.types.ts` and `*.mapper.ts`

```ts
// api-key.types.ts -- the domain shape; never the secret or its hash
export type ApiKey = {
  readonly id: string;
  readonly applicationId: string;
  readonly permissions: readonly string[];
  readonly projectAccess: "all" | readonly string[];
  readonly status: ApiKeyStatus;
  readonly createdAt: Date;
  // ...
};

export type ApiKeyWire = {           // the API contract, snake_case, ISO dates
  readonly id: string;
  readonly application_id: string;
  readonly all_projects: boolean;
  readonly project_ids: readonly string[];
  readonly created_at: string;
  // ...
};

// api-key.mapper.ts -- the row type is derived from the table, minus what
// must never leave the repository
export type ApiKeyRow = Omit<Selectable<ApiKeysTable>, "key_hash" | "tenant_id">;
export const toApiKey = (row: ApiKeyRow, projectIds: readonly string[]): ApiKey => ({ /* ... */ });
export const toApiKeyWire = (key: ApiKey): ApiKeyWire => ({ /* ... */ });
```

Three shapes, deliberately: the row is what the database has, the domain
type is what rules operate on, the wire type is the contract. Collapsing
them makes a column rename an API break -- and here, it is also what keeps
`key_hash` out of every read by construction.

### `*.schema.ts`

```ts
export const createApiKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_API_KEY_NAME_LENGTH),
    environment: z.enum(API_KEY_ENVIRONMENTS),
    permissions: z.array(z.string().regex(PERMISSION_PATTERN)).min(1).max(MAX_PERMISSIONS_PER_KEY)
      .transform((p) => [...new Set(p)].sort()),
    all_projects: z.boolean().default(false),
    project_ids: z.array(ulid).max(MAX_PROJECTS_PER_KEY).default([]),
  })
  .strict()                                         // unknown fields are errors
  .refine((b) => b.all_projects !== b.project_ids.length > 0, { path: ["project_ids"] });
```

`.strict()` is what rejects `{ "tenant_id": ... }` in a body. Every array
and string has a bound.

### `*.repository.ts`

```ts
export const createApiKeyRepository = (db: Executor) => {
  const findById = async (ctx: TenantContext, applicationId: string, keyId: string, tx?: Executor) => {
    const row = await scoped(tx ?? db, ctx)       // the tenant predicate, by construction
      .selectFrom("api_keys")
      .select(COLUMNS)                             // explicit; key_hash is not in it
      .where("application_id", "=", applicationId)
      .where("id", "=", keyId)
      .executeTakeFirst();
    return row ? toApiKey(row, /* ... */) : null;  // find* returns T | null
  };
  // insert, listByApplication, expireBy, revoke ...
  return { findById /* ... */ };
};
```

A repository MUST NOT: hold a business rule, throw a not-found `AppError`,
call another repository, open a transaction (it accepts `tx`), enqueue,
or touch a cache. Every query goes through `scoped()`
([`07`](./07-REPOSITORY-DATABASE-STANDARDS.md)); `unsafeUnscoped` is
banned in repositories by lint.

### `*.service.ts`

```ts
export const createApiKeyService = (deps: { db: Db; pepper: string; now?: () => Date }) => {
  const keys = createApiKeyRepository(deps.db);
  const tenancy = createTenancyRepository(deps.db);

  const create = async (ctx: TenantContext, applicationId: string, body: CreateApiKeyBody) =>
    deps.db.transaction().execute(async (tx) => {
      assertApplicationInScope(ctx, applicationId);            // rule
      assertWithinCallerGrant(ctx, body.permissions, /*...*/); // rule: no escalation
      const application = await tenancy.findApplication(ctx, applicationId, tx);
      if (!application) throw new AppError("application_not_found"); // absent == foreign
      // ...
      return { apiKey, plaintext };
    });

  return { create, list, get, rotate, revoke, authenticate };
};
```

The service is where rules live, where transactions open, and where
`AppError`s are thrown. It MUST NOT import `fastify` or anything under
`http/` (lint-enforced): the worker calls services too.

### `*.routes.ts`

```ts
const applicationParams = z.object({ application_id: z.string().regex(ULID_PATTERN) }).strict();

export const registerApiKeyRoutes = (app: FastifyInstance, apiKeys: ApiKeyService): void => {
  app.post(
    "/applications/:application_id/api-keys",
    { config: { permission: "api-key:create" } },    // required: SEC-AZ-01
    async (request, reply) => {
      const { application_id } = applicationParams.parse(request.params);
      const body = createApiKeyBodySchema.parse(request.body);

      const issued = await apiKeys.create(tenantOf(request), application_id, body);

      return created(request, reply, { ...toApiKeyWire(issued.apiKey), key: issued.plaintext },
        `/v1/applications/${application_id}/api-keys/${issued.apiKey.id}`);
    },
  );
  // ...
};
```

A route handler parses, calls one service function, and responds through
`http/respond.ts`. No `try/catch` -- a thrown `AppError` or `ZodError`
reaches the central error handler. No rule, no query. Authentication and
the permission check are **not** in the handler: they run in hooks, driven
by the route's `config` (`http/authentication.ts`); a route with neither
`permission` nor `public: true` fails to register.

## The request pipeline (fixed order, `app.ts`)

1. `onRequest` -- request id, trace context, completion log line
   (`http/request-context.ts`).
2. `onRequest` -- authentication, inside the `/v1` scope
   (`http/authentication.ts`).
3. body parsing (Fastify), 1 MiB limit.
4. `preHandler` -- the route's declared permission.
5. handler.
6. error handler -- every failure rendered as the error envelope
   (`http/error-handler.ts`).

Hooks throw `AppError`; they never write a response themselves.

## Tests a module ships with

| File | Proves |
|---|---|
| `*.crypto.test.ts`, `*.schema.test.ts`, `*.mapper.test.ts` (unit) | pure logic, schema edges |
| `tests/<module>.int.test.ts` | the service against a real database |
| `tests/<module>-http.int.test.ts` | HTTP: status codes, the permission per route, **the cross-tenant 404 on every `:id` route**, and any "no escalation" rule |

## Checklist for a new module

- [ ] `docs/API/*.md` specifies the endpoints (write it first if not)
- [ ] `*.constants.ts` -- limits, each tracing to a `docs/` value
- [ ] `*.types.ts` + `*.mapper.ts` -- row/domain/wire; secrets never in the row type
- [ ] `*.schema.ts` -- `.strict()`, every string and array bounded
- [ ] `*.repository.ts` -- `ctx` first, every query through `scoped()`
- [ ] `*.service.ts` -- a factory; rules, transactions, `AppError`s; absent == foreign
- [ ] `*.routes.ts` -- every route declares `permission` (or `public: true`, listed in `docs/API/02`)
- [ ] registered in `app.ts` inside the `/v1` scope, after authentication
- [ ] unit tests + service integration test + HTTP integration test with the cross-tenant 404s
- [ ] `MEMORY/records/{TASK-ID}.md` + `TASKS/PROGRESS.md`

## Acceptance Criteria

- [x] A complete vertical slice is shown for one real module, taken from
      working, tested code.
- [x] Each layer states what it must not do, and the lint rules that enforce
      it are named.
- [x] The row/domain/wire separation and the `ctx`-first rule appear in every
      template they apply to.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (sections 5-9)
- `docs/ENGINEERING/07-REPOSITORY-DATABASE-STANDARDS.md`
- `services/api/src/modules/api-keys/` (the source this document abridges)
