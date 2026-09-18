# 03 - Naming Conventions

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 2 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

Names are this codebase's cheapest form of documentation and its cheapest
form of bug. A platform whose whole product is "one canonical identity for
one derivative" cannot afford three words for the same thing, and cannot
afford one word for three things.

## The case table

| Context | Case | Example |
|---|---|---|
| Directory | `kebab-case` | `image-processing-service/` |
| Source file | `kebab-case` + layer suffix | `asset-version.service.ts` |
| Type, interface, class, branded id | `PascalCase` | `StorageAdapter`, `AssetId` |
| Function, method, variable | `camelCase` | `computeParamsHash` |
| Module-level constant | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_BYTES` |
| Const-object key | `UPPER_SNAKE_CASE` | `ASSET_STATUS.READY` |
| Const-object value | `snake_case` string | `"ready"` |
| Zod schema | `camelCase` + `Schema` | `createAssetBodySchema` |
| Generic type parameter | `TSomething`, not `T` alone past one | `TRow`, `TResult` |
| DB table | `snake_case`, plural | `asset_versions` |
| DB column | `snake_case` | `params_hash` |
| Wire JSON field | `snake_case` | `"content_type"` |
| Env var | `UPPER_SNAKE_CASE`, domain prefix | `STORAGE_S3_BUCKET` |
| Error code | `snake_case`, `subject_problem` | `asset_not_found` |
| Permission | `resource:action`, `resource:scope:action` | `asset:project:delete` |
| Redis key | `img:v1:<tenant>:<entity>:<id>` | see section 16 |
| Queue, job, span | `kebab-case` | `generate-derivative` |
| Git branch | `feat/P{phase}-{seq}-summary` | `feat/P3-04-avif-encode` |
| Feature flag | `snake_case` | `avif_auto_negotiation` |

### Why `snake_case` on the wire

The delivery protocol, the database, and the API all name the same concepts
(`params_hash`, `content_type`, `created_at`). Using one case across all
three means a field name in a log line, a SQL query, a CDN cache key debug
header, and a JSON response is literally the same string -- greppable, and
impossible to mistranslate. TypeScript stays `camelCase` internally; the
`*.mapper.ts` files are the single conversion point, and they are unit
tested (section 22).

This is a code-side convention until `docs/API/01-API-STANDARDS.md` is
flipped to Final by `P0-09`, which is its normative home.

## Function naming by intent

| Prefix | Contract | Returns |
|---|---|---|
| `find*` | May legitimately be absent | `T \| null` |
| `get*` | Absence is an error | `T`, throws |
| `list*` | A bounded collection | `readonly T[]` |
| `count*` | A number only | `number` |
| `insert*`, `update*`, `delete*` | Repository writes | the row or `void` |
| `create*`, `archive*`, `publish*` | Service-level domain operations | domain type |
| `to*` | Pure conversion | the other shape |
| `is*`, `has*`, `can*` | Predicate, no side effects | `boolean` |
| `assert*`, `ensure*` | Throws when the condition fails | `void` |
| `compute*`, `normalize*`, `derive*` | Pure, deterministic | the value |
| `enqueue*` | Adds a job, does not run it | `void` |
| `handle*` | An entry point (HTTP handler, job handler) | `void`/`Promise<void>` |

The `find*`/`get*` split carries real weight: "the row is absent" is a fact
a repository may report, while "that is a 404" is a decision only the
service may make. Mixing the two puts HTTP semantics in the data layer.

`compute*`/`normalize*` names are reserved for genuinely pure functions. A
`computeX` that reads a clock, a config, or a database is misnamed, and in
`packages/transform-params` it would also be a correctness bug -- the
function must produce identical output in an API process, a worker, a CDN
edge, and an SDK test run (ADR-004).

## Domain vocabulary

These terms are fixed by `docs/`. Code that uses them loosely contradicts
the specification it claims to implement.

| Use | Never | Because |
|---|---|---|
| `asset` | `image`, `file`, `media` | An asset is the logical resource; an image is bytes |
| `original` | `source`, `master`, `raw` | `docs/ASSET/` uses `original` |
| `derivative` | `thumbnail`, `variant`, `rendition` | A thumbnail is one kind of derivative |
| `version` | `revision`, `generation` | A version is new original bytes, not a transform |
| `object` / `object_key` | `path`, `file_path`, `s3_key` | `s3_key` leaks the provider (ADR-001) |
| `cache_key` | `key` alone | Distinct from `object_key` -- conflating them is ADR-004's failure mode |
| `params_hash` | `hash`, `digest`, `signature` | `signature` means the HMAC of a signed URL (ADR-006) |
| `derivative_id` | `variant_id` | Defined by `IMAGE-DELIVERY-PROTOCOL/17` |
| `tenant` / `project` / `application` | `account`, `org`, `client` | Three distinct scopes in the tenancy chain |
| `api_key` | `token`, `secret` | A bearer token and an HMAC secret are different things |
| `signature` | `hash`, `hmac` | The signed-URL signature specifically (ADR-006) |
| `quota` | `limit` alone | A quota is a metered allowance; a limit is a hard bound |

A short quiz that the naming must always pass: if a reader sees `key` in a
diff, can they tell whether it is an object key, a cache key, a Redis key,
or an API key? If not, the name is wrong -- there is no context in which
bare `key` is acceptable in this codebase.

## Abbreviations

Allowed, because they are unambiguous here and appear in the protocol:
`id`, `url`, `uri`, `ttl`, `dpr`, `mime`, `hmac`, `cdn`, `db`, `px`, `ms`.

Banned: `img` (except in the Redis key prefix), `tmp`, `res`/`req` outside
an HTTP handler signature, `obj`, `val`, `data` as a variable name, `util`
as a variable name, `mgr`, `svc`, `repo` as identifiers (the filename suffix
already says it), and any single letter except a loop index or a generic
parameter.

## Units in names

A number without a unit in its name is a bug waiting for a reader to guess
wrong. Every quantity carries its unit:

`byte_size`, `width_px`, `ttl_seconds`, `timeout_ms`, `max_upload_bytes`,
`quality_percent`, `backoff_delay_ms`.

Not: `size`, `width`, `ttl`, `timeout`, `quality`.

## Booleans

Predicate-shaped and positive. `isPublic`, `hasDerivative`,
`shouldReprocess`, `canSign`.

Never negated in the name (`isNotPublic`, `disableCache`) -- a negated name
produces `!isNotPublic` at a call site, which every reader misreads at least
once. A flag that must express "off" is `cacheEnabled: false`.

## Acceptance Criteria

- [x] Every case decision is stated with an example, including the wire and
      database cases, rather than left to the reader.
- [x] The `find*`/`get*` contract and the purity contract on
      `compute*`/`normalize*` are stated as rules with their reasoning.
- [x] The domain vocabulary table names the term, the banned alternatives,
      and the specification document that fixes the term.

## Open Questions

- `snake_case` on the wire is ratified into `docs/API/01-API-STANDARDS.md`
  by `P0-09`. If that task decides `camelCase` instead, this document and
  every `*.schema.ts` change together, not separately.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 2)
- `docs/API/01-API-STANDARDS.md` (normative wire naming)
- `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md` (`derivative_id`)
- `docs/STORAGE/04-OBJECT-NAMING.md` (`object_key`, `params_hash`)
- `docs/CDN/01-CACHE-KEY.md` (`cache_key`)
- `MEMORY/DECISIONS.md` (`ADR-004` -- why these three must not be conflated)
