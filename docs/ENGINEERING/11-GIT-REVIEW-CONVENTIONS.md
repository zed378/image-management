# 11 - Git & Review Conventions

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 24 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

> `TASKS/00-TASK-CONVENTIONS.md` is **normative** for task ids, branches,
> commits, and the Definition of Done. This document does not restate those
> rules; it covers the mechanics around them -- commit hygiene, the pull
> request template, and what "reviewed" means here.

## Purpose

Most of this repository's work will be done by sessions with no memory of
each other. The git history and the pull request are therefore not
paperwork; they are the only continuous record of intent, alongside
`MEMORY/`. A commit that does not say which task it serves has lost the
join key the entire plan is indexed by.

## The join key

`TASKS/00-TASK-CONVENTIONS.md` makes `P{phase}-{seq}` the identifier shared
by the phase file, the branch, the commit subject, the pull request title,
`MEMORY/records/{TASK-ID}.md`, and the `TASKS/PROGRESS.md` row. Six places,
one string. Getting it right costs nothing; getting it wrong makes a piece
of work unfindable six months later.

```
Task        P2-07
Branch      feat/P2-07-presigned-upload
Commit      P2-07: add presigned upload endpoint
PR title    P2-07: add presigned upload endpoint
Record      MEMORY/records/P2-07.md
Board       TASKS/PROGRESS.md -> row P2-07
```

## Commit hygiene

- Subject: `P{phase}-{seq}: <imperative summary>`, at most 72 characters, no
  trailing period. Imperative -- "add", not "added" or "adds".
- Body: wrapped at 72 columns, explaining **why**. The diff already shows
  what. Reference the documents implemented:

```
P2-07: add presigned upload endpoint

Implements docs/API/11-UPLOAD-API.md and docs/STORAGE/10-STORAGE-PROVIDER-ADAPTER.md.

Uploads go direct-to-storage via a presigned PUT rather than through the
API process, so a 25 MiB upload does not occupy an API worker for its
duration. The asset row is created first in `pending` and moved to `ready`
by the completion callback, which is what makes an abandoned upload
collectable by the sweeper instead of an orphan.

TTL is bounded by STORAGE_PRESIGN_MAX_TTL_SECONDS; see ADR-002 for why the
S3-compatible presign path is the only one implemented.
```

- One logical change per commit. A commit that renames a package *and*
  fixes a bug cannot be reverted without losing one of them.
- `fixup!` commits are squashed before review, not carried into it.
- **Never** amend or force-push a branch someone is reviewing. Push a new
  commit; squash on merge.
- A commit MUST NOT contain: a secret (even a revoked one -- the history
  keeps it), a `.env` file, a generated artifact, a large binary beyond the
  test fixtures in `packages/test-utils/fixtures/`, or commented-out code.
- A commit that only formats is separate from one that changes behavior, so
  the behavior change is reviewable.

### Branch types

| Prefix | For | Merges to |
|---|---|---|
| `feat/P{phase}-{seq}-...` | A task from `TASKS/` | `main` |
| `fix/<short-name>` | A defect not tied to an open task | `main` |
| `docs/<short-name>` | Specification-only edits | `main` (direct push allowed) |
| `chore/<short-name>` | Dependency bumps, tooling | `main` |

`main` stays free of in-progress work. A branch merges only when the task's
Definition of Done is fully satisfied, `MEMORY/` record included.

A `fix/` branch that turns out to need real design becomes a new row in a
`TASKS/PHASE-*.md` file -- `AGENTS.md`'s rule against silent scope expansion
applies to bug fixes too.

## Pull request template

```markdown
## Task
P2-07 -- Presigned upload endpoint

## Implements
- docs/API/11-UPLOAD-API.md
- docs/STORAGE/10-STORAGE-PROVIDER-ADAPTER.md

## What changed
Three sentences. Why this shape, not just what the diff does.

## Definition of Done
- [ ] lint, typecheck, test pass with zero new warnings
- [ ] Tests at the layer docs/TESTING/00-TEST-STRATEGY.md requires
- [ ] docs/ file(s) updated: Draft specification -> Final (or open items noted)
- [ ] MEMORY/records/P2-07.md written
- [ ] TASKS/PROGRESS.md updated in this PR

## Security-critical (delete if not applicable)
- [ ] IDOR/BOLA test added -- location: `tests/integration/upload-api.int.test.ts:118`
- [ ] No docs/SECURITY/ or docs/MULTI-TENANCY/ control weakened
- [ ] No secret, API key, or signature reachable from a log or a response

## Deviations from the specification
None. (Or: what, why, and the MEMORY/DECISIONS.md ADR that records it.)

## Follow-ups
New rows opened in TASKS/, not fixed inline.
```

Rules:

- A PR that changes behavior with no `docs/` update is incomplete. So is one
  that closes a task with no `MEMORY/` record. Both are in the Definition of
  Done, which means neither is follow-up work.
- The IDOR/BOLA test's **location** is named, not just checked off. A
  checkbox is a claim; a file and line number is evidence, and
  `TASKS/00-TASK-CONVENTIONS.md` asks for it specifically.
- A PR touching more than ~400 lines of non-generated code SHOULD be split.
  Review quality falls off a cliff past that, and this repository's riskiest
  changes are small ones.
- A deviation from the specification is declared in the PR, not discovered
  in review. An undeclared deviation is the one thing that makes the
  specification untrustworthy for every later task.

## Review

### The reviewer's job

In priority order -- and the order matters, because review attention is
finite:

1. **Correctness against the specification.** Does this do what the
   documents in `Implements:` say? A reviewer who has not opened those
   documents is reviewing style.
2. **Tenant isolation.** Every query scoped, every `:id` route tested.
3. **Secret and signature handling.** Nothing loggable, nothing in a
   response.
4. **The single-implementation invariants.** No second params-hash, no
   provider SDK outside the adapter.
5. **Tests that would actually fail** if the code were wrong.
6. **Readability and reuse.** Real, but last.

Formatting is never a review comment -- Prettier owns it (doc 10). Naming is
a review comment when it breaks
[`03-NAMING-CONVENTIONS.md`](./03-NAMING-CONVENTIONS.md)'s domain
vocabulary, because that is a correctness matter here, not taste.

### Blocking findings

The five in section 24 of
[`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md), expanded in
[`14-CODE-REVIEW-CHECKLIST.md`](./14-CODE-REVIEW-CHECKLIST.md). A blocking
finding is stated as a blocking finding, plainly, with the document it
violates. "Maybe consider possibly scoping this query?" on a cross-tenant
leak does the author no favours.

### Comment conventions

| Prefix | Means |
|---|---|
| `blocking:` | Must change before merge; name the document violated |
| `question:` | I do not understand this yet; answer may resolve it |
| `suggestion:` | Optional improvement; author may decline |
| `nit:` | Trivial; never blocking |
| `praise:` | Worth keeping and copying |

An unprefixed comment defaults to `suggestion:`. `blocking:` is never
implied -- an author guessing which comments block is an author who will
guess wrong in both directions.

### For AI agent sessions

A session reviewing its own work is not a review, and nothing in this
document pretends otherwise. What a self-review does achieve:

- running the blocking checklist in
  [`14-CODE-REVIEW-CHECKLIST.md`](./14-CODE-REVIEW-CHECKLIST.md) explicitly,
  rather than trusting that the code was written correctly;
- confirming the `Implements:` documents were actually read and actually
  say what the code does;
- writing the `MEMORY/` record **before** declaring the task done, since
  writing it surfaces the decisions that were made without noticing.

Where a human review is not available, the checklist and the tests are the
gate. That is precisely why so many of this category's rules are
machine-enforced rather than review-enforced.

## Merge

- Squash merge, with the `P{phase}-{seq}: <summary>` subject preserved, so
  `main`'s history is one commit per task and `git log --oneline` reads as
  the project's progress.
- The PR body becomes the merge commit body -- which is why it carries the
  `Implements:` list and the deviations.
- No merge on a red pipeline. No merge with a `blocking:` comment
  outstanding.
- Delete the branch after merge. `TASKS/PROGRESS.md` is the board; stale
  branches are not.

## Acceptance Criteria

- [x] The six places the task id must appear are enumerated, matching
      `TASKS/00-TASK-CONVENTIONS.md`.
- [x] The PR template includes the Definition of Done and the security items
      as checkboxes, and asks for the IDOR test's location as evidence.
- [x] Review priorities are ordered, and blocking versus non-blocking is
      explicit rather than inferred from tone.

## Open Questions

- Whether the PR template is enforced by a repository template file or by CI
  is a `P0-03` decision.
- Whether `main` gets branch protection with required reviewers depends on
  how many humans are in the loop -- worth deciding explicitly rather than
  inheriting a default.

## Related Documents

- `TASKS/00-TASK-CONVENTIONS.md` (normative for ids, branches, commits, DoD)
- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 24)
- `docs/ENGINEERING/14-CODE-REVIEW-CHECKLIST.md` (the blocking checklist)
- `docs/DEVOPS/02-CI-CD.md` (the pipeline that gates the merge)
- `MEMORY/records/TEMPLATE.md` (the record every task owes)
- `AGENTS.md` (the loop every session follows)
