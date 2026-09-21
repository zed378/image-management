# 04 - TypeScript Standards

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 4 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

Use the type system as the first layer of defence. This platform's two
highest-cost bug classes -- a resource id used in the wrong tenant's scope,
and an untrusted query parameter treated as validated -- are both
preventable at compile time. The settings and patterns here exist to make
those specific mistakes not compile.

## Compiler configuration

`tsconfig.base.json` at the root; every package extends it and overrides
only paths.

```jsonc
{
  "compilerOptions": {
    // Correctness
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,

    // Hygiene
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,

    // Modules (ADR-018: just-in-time packages, bundled services)
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2023",
    "lib": ["ES2023"],
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,

    // Output: none. Packages export source; services are bundled by tsup.
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

Three of these earn their keep specifically here:

- **`noUncheckedIndexedAccess`** -- every `req.query.w`, every
  `headers["accept"]`, every `parts[2]` of a delivery URL becomes
  `T | undefined`. This codebase parses untrusted strings on every delivery
  request; the flag converts an entire class of runtime `undefined` into a
  compile error.
- **`exactOptionalPropertyTypes`** -- keeps `null` ("known empty") and
  absent ("not applicable") distinguishable, which section 13's response
  rules depend on.
- **`useUnknownInCatchVariables`** -- forces every `catch` to narrow before
  reading `.message`, which is how an unexpected non-`Error` throw stops
  becoming `"undefined"` in a log line.

`skipLibCheck` is the one concession: third-party type errors are not this
repository's to fix.

## Banned constructs

| Construct | Instead | Why |
|---|---|---|
| `any` | `unknown` + a Zod parse | `any` disables checking silently and transitively |
| `!` non-null assertion | narrow, or throw `AppError` | The assertion is a claim no one re-checks |
| `as` (outside three cases) | a type guard or a schema parse | An assertion is a lie the compiler believes |
| `enum` | `as const` object + derived union | `enum` emits runtime code and has nominal quirks |
| `namespace` | modules | Obsolete with ESM |
| `default export` | named export | Consistent names across the tree; lint-enforced |
| `require()` / `module.exports` | `import` / `export` | ESM only |
| `Function`, `object`, `{}` as types | a precise shape | They accept almost anything |
| `@ts-ignore` | `@ts-expect-error` + a reason | `ignore` rots silently when the error goes away |

The three sanctioned uses of `as`:

1. `as const` on a literal;
2. immediately after a Zod `parse`, where the schema is the proof;
3. inside a branded-id factory in a `*.types.ts`, where the validation
   happens one line above.

Anything else carries a one-line comment stating why it is sound, and a
reviewer is entitled to reject it.

## Branded ids

The single highest-value type pattern in this codebase. A `TenantId`, a
`ProjectId`, and an `AssetId` are all 26-character strings, and passing one
where another belongs is how a cross-tenant lookup gets written by accident.

```ts
// packages/tenancy/src/branded.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
```

```ts
// asset.types.ts
import type { Brand } from "@image-delivery/tenancy";
import { AppError } from "@image-delivery/errors";
import { isUlid } from "@image-delivery/schema";

export type AssetId = Brand<string, "AssetId">;
export type AssetVersionId = Brand<string, "AssetVersionId">;
export type DerivativeId = Brand<string, "DerivativeId">;

/** The only sanctioned way to produce an AssetId from untrusted input. */
export const toAssetId = (raw: string): AssetId => {
  if (!isUlid(raw)) throw new AppError("invalid_id");
  return raw as AssetId; // sound: validated on the line above
};
```

Rules:

- Every user-facing resource id has a brand.
- A brand is constructed only by its `to*Id` factory, which validates. A
  bare `as AssetId` outside that factory is a review finding.
- Repository and service signatures take branded ids, never `string`. This
  is what makes `findById(ctx, projectId)` fail to compile.
- Zod schemas produce `string`; the controller or mapper brands it. Keep the
  brand out of the schema so the schema stays serializable and shareable
  with SDKs.

## Modelling state: unions, not flags

```ts
// Illegal states are unrepresentable.
export type Derivative =
  | { readonly status: "pending"; readonly requestedAt: Date }
  | { readonly status: "ready"; readonly objectKey: ObjectKey; readonly byteSize: number }
  | { readonly status: "failed"; readonly errorCode: ErrorCode; readonly failedAt: Date };
```

versus the shape that guarantees a `null` check will be forgotten:

```ts
// Do not do this.
type Derivative = {
  status: string;
  objectKey?: string | null;
  byteSize?: number | null;
  errorCode?: string | null;
};
```

With the union, `switch (d.status)` plus `noFallthroughCasesInSwitch` means
adding a fourth state produces a compile error at every place that must
handle it. That is the property worth having in a system where a derivative
can be pending for a while.

Use an exhaustiveness guard at the end of every such `switch`:

```ts
const assertNever = (value: never): never => {
  throw new AppError("internal", { cause: `unhandled: ${String(value)}` });
};
```

## Immutability

- `readonly` on every field of a domain type.
- `readonly T[]` for array parameters and returns. A repository returning a
  mutable array invites a caller to sort it in place and surprise the next
  caller.
- No parameter reassignment, no mutation of a parameter's contents. Build a
  new value.
- Domain objects are values. Updating one means constructing the next one,
  not mutating the current one -- this is also what makes the mapper layer
  testable as pure functions.

## Function signatures

- Every exported function has an explicit return type. Inference at a module
  boundary means a refactor inside changes the public type silently.
- More than three parameters becomes a single options object with named
  fields -- except that `ctx: TenantContext` always stays the first
  positional parameter, because its whole purpose is to be impossible to
  omit or misname (ADR-005).
- No optional parameter that changes behavior. `findById(ctx, id, tx?)` is
  fine (`tx` is plumbing); `deleteAsset(ctx, id, hard?)` is not -- that is
  two operations.
- No boolean parameters at a call site: `deleteAsset(ctx, id, true)` is
  unreadable. Two functions, or an options object with a named field.

## Async

- `async`/`await` only; no `.then()` chains in application code.
- `@typescript-eslint/no-floating-promises` is an error. A deliberately
  unawaited promise is `void somePromise;` with a comment -- and in this
  codebase that is almost always wrong, because the work that looks
  fire-and-forget (a job enqueue, a cache invalidation) is work whose
  failure matters.
- No `await` inside a loop over a collection when the operations are
  independent: batch the query (section 15) or use `Promise.all` with a
  bounded concurrency helper. An unbounded `Promise.all` over user-supplied
  input is a denial-of-service vector, so the helper has a limit.
- Every external call has a timeout: the database (statement timeout), the
  storage adapter, every inter-service client, every webhook delivery. A
  call with no timeout is an outage waiting for a slow dependency.
- `AbortSignal` is threaded through storage and HTTP calls so a cancelled
  request stops doing work.

## Errors in types

- A function that can fail in an expected way throws a typed `AppError`
  (section 12). It does not return a `{ ok, error }` result object -- one
  error channel for the whole codebase is what makes the central error
  middleware possible.
- `catch (err: unknown)` always; narrow with `err instanceof AppError` before
  reading fields.
- Never `catch` without either handling or rethrowing. A `catch` that logs
  and continues has decided the operation succeeded -- if that is true, say
  so in a comment.

## Acceptance Criteria

- [x] Every compiler flag is listed explicitly, with the three
      platform-specific ones justified against real failure modes here.
- [x] The banned-construct table gives the replacement for each entry, and
      names the three sanctioned uses of `as`.
- [x] The branded-id pattern is shown end to end, including who may
      construct a brand.

## Open Questions

- Whether `packages/*` build via `tsc` project references or a bundler is
  settled in `P0-01`; the compiler flags above hold either way.
- The bounded-concurrency helper's default limit is set alongside the load
  tests in `P7-05` (`docs/PERFORMANCE/`).

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 4)
- `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md` (the lint rules that enforce this)
- `docs/ENGINEERING/06-ERROR-RESPONSE-STANDARDS.md` (the `AppError` contract)
- `MEMORY/DECISIONS.md` (`ADR-003` ULIDs, `ADR-005` tenant scoping)
