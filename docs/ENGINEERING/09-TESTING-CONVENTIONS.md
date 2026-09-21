# 09 - Testing Conventions

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 22 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

> `docs/TESTING/00-TEST-STRATEGY.md` decides **what** is tested at which
> layer, and is normative for that. This document covers **how the test code
> looks**: file layout, naming, fixtures, the mandatory suites, and the CI
> gates.

## Purpose

Four of this platform's invariants cannot be verified by reading code -- they
are only ever true because a test says so on every commit:

1. a foreign tenant's id returns `404` (ADR-005, `docs/SECURITY/11`);
2. `params_hash` is stable across releases, languages, and processes
   (ADR-004/009);
3. every storage adapter behaves identically (ADR-001);
4. a redelivered job does nothing the second time (ADR-007).

Those four are the mandatory suites below. Everything else in this document
serves them.

## Layout

| Kind | Location | Pattern | Dependencies |
|---|---|---|---|
| Unit | beside the source | `*.test.ts` | none; collaborators stubbed |
| Integration | `tests/integration/` | `*.int.test.ts` | Testcontainers: Postgres, Redis, MinIO |
| API contract | `tests/integration/` | `*-api.int.test.ts` | the service via `app.ts`, no port bound |
| Conformance | `packages/<pkg>/tests/` | `*.conformance.test.ts` | every implementation of an interface |
| Golden vector | `packages/transform-params/tests/` | `*.vectors.test.ts` | a committed fixture file |
| E2E | `tests/e2e/` | `*.e2e.test.ts` | the docker-compose stack |
| Load | `tests/load/` | k6 / artillery scripts | a deployed environment |

Integration tests import `app.ts`, never `server.ts` -- no port is bound, so
the suite parallelizes and cannot collide on a port in CI.

## Naming

```ts
describe("AssetService.createAsset", () => {
  it("creates an asset in the caller's project", async () => {});
  it("rejects an upload larger than MAX_UPLOAD_BYTES", async () => {});
  it("returns the existing asset when the idempotency key is reused", async () => {});
  it("throws folder_not_found when the folder belongs to another tenant", async () => {});
});

describe("GET /v1/assets/:assetId", () => {
  it("returns 200 with the asset for its owner", async () => {});
  it("returns 404 when the asset belongs to another tenant", async () => {});
  it("returns 401 without an API key", async () => {});
  it("returns 403 when the key lacks asset:read", async () => {});
});
```

- `describe` names the unit: `Class.method`, `functionName`, or
  `METHOD /path`.
- `it` states the behavior and its condition in the present tense, from the
  caller's point of view. Never `it("works")`, `it("test 1")`, or
  `it("should work correctly")`.
- One assertion subject per test. A test asserting five unrelated things
  reports one failure for five bugs and stops at the first.

## Structure

Arrange, act, assert -- in that order, separated by blank lines:

```ts
it("returns 404 when the asset belongs to another tenant", async () => {
  const foreign = await factories.asset({ tenantId: tenantB.id });

  const res = await client.as(tenantA).get(`/v1/assets/${foreign.id}`);

  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe("asset_not_found");
});
```

No assertion in the arrange block; no logic in the assert block. A
conditional in a test means two tests.

## Fixtures and factories

```ts
// packages/test-utils/src/factories.ts
export const factories = {
  tenant: (overrides?: Partial<TenantInput>) => Promise<Tenant>,
  project: (overrides?: Partial<ProjectInput>) => Promise<Project>,
  apiKey: (overrides?: Partial<ApiKeyInput>) => Promise<{ key: string; record: ApiKey }>,
  asset: (overrides?: Partial<AssetInput>) => Promise<Asset>,
  assetVersion: (overrides?: Partial<AssetVersionInput>) => Promise<AssetVersion>,
  derivative: (overrides?: Partial<DerivativeInput>) => Promise<Derivative>,
};
```

- Every factory has complete, valid defaults and accepts partial overrides.
  A test states only what it cares about, so the reader can see what the
  test is actually about.
- Factories are typed. A factory taking `Record<string, unknown>` lets a
  schema change break tests silently at runtime instead of at compile time.
- Every integration test creates **its own tenant**. No shared seed row, no
  `beforeAll` fixture mutated by several tests -- that is how a suite becomes
  order-dependent, and an order-dependent suite eventually gets its failures
  ignored.
- Test images live in `packages/test-utils/fixtures/images/` as small, real
  files, one per format the platform accepts, plus the deliberately awkward
  cases: a CMYK JPEG, a 16-bit PNG, an animated GIF, an image with EXIF
  orientation, a truncated file, and a file whose extension lies about its
  content. Those last two exist because `docs/SECURITY/` requires content
  sniffing, and a test suite with only well-formed images proves nothing
  about it.

## Stubbing

- Stub at a boundary, not in the middle. A service test stubs the
  repository; it never stubs another function inside the same service.
- **Never stub the subject.** And specifically never stub
  `normalizeTransformParams` or `computeParamsHash` -- their entire value is
  that the real one runs (ADR-004). A test that stubs them proves nothing
  about the invariant they exist to hold.
- Time and randomness are injected -- a `clock` and an `idGenerator` passed
  in, not read from the global. A test that manipulates the system clock
  changes behavior for every parallel test in the process.
- Prefer a real dependency in a container over a stub when the stub would
  have to model the dependency's semantics. Postgres's unique-constraint
  behavior, Redis's TTL behavior, and S3's error taxonomy are all things a
  hand-written stub gets wrong in exactly the way that hides a bug.

## The four mandatory suites

### 1. Cross-tenant isolation (IDOR/BOLA)

Required for **every** `:id`-scoped route
(`TASKS/00-TASK-CONVENTIONS.md`), with no exemption for "simple" endpoints.

```ts
// packages/test-utils/src/isolation.ts
export const expectCrossTenantIsolation = (
  route: (id: string) => Request,
  createForeign: (tenantId: TenantId) => Promise<{ id: string }>,
  expectedCode: ErrorCode,
): void => {
  it("returns 404 for a resource owned by another tenant", async () => {
    const foreign = await createForeign(tenantB.id);

    const res = await route(foreign.id).as(tenantA).send();

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(expectedCode);
  });
};
```

Covered, per route: `GET`, `PATCH`/`PUT`, `DELETE`, and every nested route
(`/assets/:assetId/versions`). A write verb is the one that matters most and
is the one most often left out.

`P1-06` makes this suite a CI gate: a route registered in the router with an
`:id` parameter and no corresponding isolation test fails the build. That
check is what makes rule 2 of section 5 of
[`00-CODING-CONTEXT.md`](./00-CODING-CONTEXT.md) real rather than
aspirational.

### 2. Golden transformation vectors

```
packages/transform-params/tests/fixtures/vectors.json
[
  { "input": "?w=400&h=300",        "normalized": "h=300&w=400", "params_hash": "..." },
  { "input": "?h=300&w=400",        "normalized": "h=300&w=400", "params_hash": "..." },
  { "input": "?width=400&h=300",    "normalized": "h=300&w=400", "params_hash": "..." },
  { "input": "?w=400&h=300&q=auto", "normalized": "...",         "params_hash": "..." }
]
```

- The fixture is **append-only**. A changed `params_hash` in a diff is a
  released-contract break: it invalidates every CDN cache entry and every
  stored derivative key in existence (ADR-004). It requires an ADR before
  the code change, and it is a reviewer's job to refuse it otherwise -- not
  to re-record the fixture so the suite goes green.
- Alias pairs (`w`/`width`) and reordering pairs must hash identically. That
  is the whole point.
- Every SDK (`docs/SDK/`) runs the same fixture in its own language
  (`P6-06`). A vector file the SDKs cannot read is a vector file that does
  not do its job.

### 3. Storage adapter conformance

One suite, run against every adapter -- local, MinIO, S3, R2 -- unmodified.

- If a provider cannot pass a case, the `StorageAdapter` contract changes and
  every adapter is updated. The suite is never weakened for one provider,
  because the suite *is* ADR-001's guarantee.
- Cases include the unhappy paths that differ most between providers:
  `get` on a missing key, `delete` on a missing key (idempotent), a
  presigned URL after expiry, a presigned URL with a tampered path, a
  multi-page `list`, and a concurrent overwrite.

### 4. Job idempotency

Every handler, one test:

```ts
it("is a no-op when the job is redelivered", async () => {
  await handleGenerateDerivative(job);
  const first = await derivativeRepository.findByParamsHash(ctx, paramsHash);

  await handleGenerateDerivative(job); // same payload, same jobId

  const all = await derivativeRepository.listByParamsHash(ctx, paramsHash);
  expect(all).toHaveLength(1);
  expect(all[0]?.id).toBe(first?.id);
});
```

## Other required tests

- **Signed URLs** (ADR-006): a valid signature passes; an invalid one, an
  expired one, and one with a tampered parameter each fail with the code
  `docs/IMAGE-DELIVERY-PROTOCOL/24-ERROR-AND-FALLBACK.md` specifies; verification is
  constant-time; a signature from another application's secret fails.
- **Permissions**: the **deny** path for every permission, not only the
  allow path. An allow-only test suite passes against a system that grants
  everything.
- **Redaction**: a known secret placed in a log context does not appear in
  the serialized output (section 18).
- **Error registry**: every code has a default message and a documented
  status.
- **Migrations**: run from empty, and from the previous release's schema,
  against a real Postgres in CI.
- **Content sniffing**: a file whose extension and magic bytes disagree is
  rejected per `docs/SECURITY/`.

## Coverage

| Scope | Threshold |
|---|---|
| `packages/*` | 90% lines, 85% branches |
| `services/*` | 80% lines, 75% branches |
| `packages/transform-params` | **100% branches** |
| `packages/errors` | **100% branches** |
| Authorization and signature-verification functions | **100% branches** |

Enforced in `vitest.config.ts` over the **combined** unit + integration run
(`pnpm test:coverage`, the CI `integration` job): the storage adapters and
the query layer are covered by integration tests by design. Excluded from
measurement: process entry points and their env loading
(`services/*/src/{server,migrate,config}.ts`, exercised by the boot tests
in a child process that coverage cannot see) and `packages/test-utils`.
One interim exception is written into the config with its reason: the
network storage adapters have a 60% branch floor until `P2-11` adds
per-backend fault injection; the floor only ratchets upward.

Thresholds are a CI gate, and they are a floor. A test that asserts nothing
meaningful in order to raise a number is worse than no test, because it makes
the number lie to the next person who trusts it. The three 100% entries are
the code where a single unexercised branch is a security bug or a
cache-invalidating bug, which is why they are absolute rather than
aspirational.

## What tests do not assert

- Log output, except where the log line *is* the requirement (audit entries,
  redaction).
- Internal call counts, except where the count is the requirement (an
  idempotent handler performing exactly one write).
- Exact prose of an error message. Assert on `error.code`; the message is for
  humans and will be edited.

## Acceptance Criteria

- [x] The four invariants that only a test can hold are named, with a
      specified mandatory suite for each.
- [x] Coverage thresholds are numeric, per-scope, and CI-gated, with the
      three 100% cases justified.
- [x] The isolation helper and the golden-vector fixture format are given
      concretely enough to implement without further decisions.

## Open Questions

- `docs/TESTING/00-TEST-STRATEGY.md` confirms the thresholds; where it
  differs, it wins.
- The hash algorithm inside the golden vectors is fixed by `P3-10`
  (`docs/IMAGE-DELIVERY-PROTOCOL/18-CACHE-KEY-SPECIFICATION.md`); the fixture format above
  is independent of that choice.
- Whether the CI gate in suite 1 is implemented by router introspection or
  by a lint rule over route files is a `P1-06` decision.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 22)
- `docs/TESTING/` (the whole category -- normative for what to test)
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`, `docs/SECURITY/12-SIGNED-URL.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/17-DERIVATIVE-IDENTITY.md`, `18-CACHE-KEY-SPECIFICATION.md`
- `TASKS/00-TASK-CONVENTIONS.md` (the IDOR/BOLA requirement)
- `TASKS/PHASE-1-TENANCY-AUTH.md` (`P1-06` makes suite 1 a gate)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-004`, `ADR-005`, `ADR-006`, `ADR-007`)
