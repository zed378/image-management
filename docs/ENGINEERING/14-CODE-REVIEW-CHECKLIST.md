# 14 - Code Review Checklist

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Companion to [`11-GIT-REVIEW-CONVENTIONS.md`](./11-GIT-REVIEW-CONVENTIONS.md).
The list a reviewer -- human or agent -- runs before approving, and the list
an author runs before opening a pull request.

## Purpose

Review attention is finite, so this checklist is ordered by consequence, not
by convenience. Everything mechanically checkable has already been checked
by CI (doc 10); what remains here is what a machine cannot judge: whether
the code does what the specification says, and whether the tests would
notice if it did not.

---

## A. Blocking -- do not approve

Any one of these is a blocking finding, stated plainly, with the document it
violates.

### A1. A query on a tenant-owned table that does not go through `scoped()`

Look for: a raw query builder, raw SQL, or a repository call in a module
that bypasses `packages/db`'s scoped entry point. Also: an `INSERT` that
takes `tenant_id` or `project_id` from a request payload, and an `UPDATE`
or `DELETE` whose predicate is only `where id = ?`.

Violates ADR-005, `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`.

### A2. An `:id` route with no cross-tenant isolation test

Every `:id`-scoped route -- including nested routes and every write verb.
The pull request must name the test's file and line, not just check a box.

Violates `TASKS/00-TASK-CONVENTIONS.md`, `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`.

### A3. A second implementation of transformation-param normalization or hashing

Look for: a `createHash` call outside `packages/transform-params`, a
locally-built cache key, a locally-built derivative object key, a
hand-sorted query string, or a re-implemented alias table.

Also blocking: a **changed expected hash** in `vectors.json` without an ADR.
That is a released-contract break, and re-recording the fixture to make the
suite pass is the specific mistake this rule exists to catch.

Violates ADR-004, ADR-009.

### A4. A secret, API key, or signature reachable from a log or a response

Look for: a new field name that would match nothing in `REDACT_PATHS`; an
`err.message` forwarded to a client; a presigned or signed URL passed into a
log context; a `debug` line carrying a full request body on an upload path;
a partial API key logged "for debugging".

Violates `docs/SECURITY/`, doc 12's never-log list, ADR-006.

### A5. A weakened `docs/SECURITY/` or `docs/MULTI-TENANCY/` control

Including: `===` on a credential or signature; an unbounded signed-URL TTL;
a revocation that only expires by TTL; an upload path that trusts a declared
MIME type; a decode without a pixel bound; a URL fetched without an SSRF
guard; a `403` where the spec requires `404`.

And the softer form, which is equally blocking: any of the above with a
comment saying it will be fixed later.

Violates `AGENTS.md`'s hard rules and `TASKS/00-TASK-CONVENTIONS.md`.

---

## B. Specification conformance

- [ ] The `Implements:` documents were **opened and read**, and the code
      matches them. A review that skips this is a style review.
- [ ] No API shape invented that `docs/API/` does not define. If the code
      needed more precision, the `docs/API/` file gained it in the same
      change (`AGENTS.md`).
- [ ] The `docs/` file is updated: Draft specification -> Final, or the open
      items are named explicitly.
- [ ] Any deviation from the specification is declared in the pull request
      and recorded in `MEMORY/DECISIONS.md`.
- [ ] `MEMORY/records/{TASK-ID}.md` is present in this pull request.
- [ ] `TASKS/PROGRESS.md` is updated in this pull request.
- [ ] Values that correspond to a specification number (limits, TTLs,
      quotas) are constants that cite the document, not inline literals.

---

## C. Layering and structure

- [ ] Controller: parses, calls one service, responds. No `try/catch`, no
      branching on business rules, no repository or `packages/db` import.
- [ ] Service: no HTTP types, no status codes. Returns domain types, throws
      `AppError`. Owns the transaction boundary.
- [ ] Repository: `ctx` first, `scoped()` always, mapper on the way out. No
      rules, no `NotFoundError`, no cross-repository call, no enqueue.
- [ ] Mapper: pure, and tested.
- [ ] No `services/* -> services/*` import; no `packages/* -> services/*`
      import; no deep import into a package's internals.
- [ ] A new tenant-owned table is registered in `TENANT_OWNED_TABLES` and in
      the `P1-06` isolation suite.

---

## D. Types

- [ ] No `any`, no `!`, no unexplained `as`.
- [ ] Branded ids in every repository and service signature -- not `string`.
- [ ] Explicit return type on every exported function.
- [ ] State modelled as a discriminated union where illegal combinations
      would otherwise be representable.
- [ ] `readonly` on domain type fields and array parameters.
- [ ] No floating promise. Every external call has a timeout.

---

## E. Errors and responses

- [ ] Every throw is a typed `AppError` with a code from the registry.
- [ ] A new code is added to the registry **and** to
      `docs/DEVELOPER/10-ERRORS.md`, and does not repurpose a released code.
- [ ] `retryable` is set deliberately -- a permanent failure must not be
      retried five times; a transient one must not fail immediately.
- [ ] `expose` is `false` for anything whose message could carry internals.
- [ ] Responses go through `ok()` / `created()` / `paginated()` /
      `noContent()`, never a hand-written literal.
- [ ] A foreign-tenant `404` is byte-identical to an absent-resource `404`.

---

## F. Data and queries

- [ ] No N+1: no `await repository.find*` inside a loop.
- [ ] No `SELECT *`; explicit column lists.
- [ ] Cursor pagination, not `OFFSET`, on tenant data.
- [ ] Every read filters `deleted_at is null`.
- [ ] New index: the migration comment names the query it serves, and the
      `EXPLAIN` output is in the `MEMORY/` record.
- [ ] Migration is additive and forward-compatible with the previous
      release; a large backfill is a job, not a migration.
- [ ] Every invariant that matters is also a database constraint, not only
      an application check.
- [ ] No third-party or storage call inside an open transaction.

---

## G. Cache and queue

- [ ] Every cache key contains the tenant id and is built by a `cacheKey()`
      builder.
- [ ] Every `set` has an explicit TTL; the key is in doc 08's catalogue.
- [ ] Invalidation happens after commit, and is a delete rather than a
      write.
- [ ] The read-through path is tested with the cache disabled.
- [ ] Job payload: ids only, with a Zod schema parsed at the top of the
      handler, carrying `tenantId`, `projectId`, and `requestId`.
- [ ] The handler is idempotent, with a redelivery test -- and not by
      `jobId` deduplication alone.
- [ ] `attempts` and `backoff` are explicit; a permanent failure is not
      retried.
- [ ] The worker uses scoped repositories, exactly like the API.

---

## H. Tests

- [ ] The tests would **fail** if the code were wrong. Read one and ask what
      it actually pins down.
- [ ] Deny paths, not only allow paths: every permission's rejection is
      tested.
- [ ] Failure paths: the quota rejection, the decode failure, the expired
      signature, the missing object.
- [ ] Each integration test creates its own tenant; no shared mutable
      fixture, no order dependency.
- [ ] Nothing stubbed that is the subject -- and never
      `computeParamsHash` or `normalizeTransformParams`.
- [ ] Time and randomness injected, not read from the global.
- [ ] Assertions are on `error.code` and observable behavior, not on log
      output or message prose.
- [ ] A new transformation parameter added vectors, and existing vectors'
      hashes are unchanged.
- [ ] A new storage adapter passes the conformance suite unmodified.

---

## I. Operability

- [ ] Log lines are structured, with registered field names, at the right
      level -- and a 4xx is not an `error`.
- [ ] Errors are logged once, at the handling boundary.
- [ ] A new environment variable is in `.env.example` with a comment, and in
      the config schema, and the process fails fast if it is missing.
- [ ] A security-relevant action writes the audit **table** row, not only a
      log line.
- [ ] Graceful shutdown still holds for a changed worker.
- [ ] Nothing new runs on the request path that should be a job.

---

## J. Judgment -- worth raising, not blocking

- [ ] Is this the simplest thing that satisfies the specification?
- [ ] Does it duplicate something in `packages/` that already exists?
- [ ] Will the next person understand why, or only what? If the why is
      non-obvious, is it in the code comment, the pull request, or the
      `MEMORY/` record -- somewhere durable?
- [ ] Is the diff scoped to the task, with incidental findings opened as new
      `TASKS/` rows rather than fixed inline (`AGENTS.md`)?
- [ ] Is anything here a decision that deserves an ADR, made silently?

---

## For an agent self-reviewing its own work

A session reviewing itself is not a review
([`11-GIT-REVIEW-CONVENTIONS.md`](./11-GIT-REVIEW-CONVENTIONS.md) says so).
What it can do honestly:

1. Run **section A** explicitly, item by item, against the actual diff --
   not against a memory of having written it correctly.
2. Re-open each `Implements:` document and confirm it says what the code
   does. Assumed content is the most common source of a task that passes its
   own tests and contradicts the specification.
3. Write `MEMORY/records/{TASK-ID}.md` **before** declaring the task done.
   Writing it is what surfaces the decisions made without noticing -- and
   those are the ones worth recording.
4. State what was **not** verified. "The cross-tenant test passes for `GET`
   but the `DELETE` route is untested" is useful. Silence about it is not.

## Acceptance Criteria

- [x] Blocking findings are separated from judgment calls, so a reviewer is
      never guessing which is which.
- [x] Every blocking item names what to look for concretely and which
      document it violates.
- [x] The checklist is ordered by consequence, and excludes anything CI
      already gates.

## Open Questions

- Whether this checklist becomes a machine-readable pull request template or
  stays prose is a `P0-03` decision. Items in sections C through G are
  candidates for further lint automation, which would move them out of this
  file entirely -- the preferred direction.

## Related Documents

- `docs/ENGINEERING/11-GIT-REVIEW-CONVENTIONS.md` (the review process)
- `docs/ENGINEERING/01-CODING-STANDARDS.md` (the standard being checked)
- `docs/ENGINEERING/13-SECURITY-CODING-RULES.md` (section A5's substance)
- `TASKS/00-TASK-CONVENTIONS.md` (the Definition of Done)
- `AGENTS.md` (the hard rules sections A and B enforce)
