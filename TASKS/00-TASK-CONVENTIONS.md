# Task Conventions

These conventions apply to every task in `TASKS/` and to anyone -- human or
AI agent -- executing one. They exist so that work done by different people
(or different agent sessions) stays consistent, reviewable, and traceable
back to the documents it implements.

## Task ID

Every task has an ID of the form `P{phase}-{seq}`, e.g. `P2-07`. The ID is
the join key across:

- the task's entry in the relevant `TASKS/PHASE-*.md` file,
- the git branch (`feat/P2-07-short-name`),
- the commit subject prefix (`P2-07: add presigned upload endpoint`),
- the pull request title,
- the record in `MEMORY/records/` (`MEMORY/records/P2-07.md`),
- the row in `TASKS/PROGRESS.md`.

Never reuse an ID, even if a task is cancelled. Cancelled tasks stay in the
phase file marked `~~P2-04~~ (cancelled -- superseded by P2-09)` so the
history stays legible.

## One task at a time, in dependency order

Work `TASKS/PROGRESS.md` top to bottom within a phase. A task's `Depends on`
field lists the task IDs that must be **Done** (not just started) before it
begins. Do not start a task whose dependencies are incomplete, even if it
looks independent -- the dependency exists because an earlier decision
(schema shape, API contract, adapter interface) is assumed settled.

## Branching & commits

- One branch per task: `feat/P{phase}-{seq}-kebab-case-summary`.
- `main` stays free of in-progress work. A branch merges only when the
  task's Definition of Done is fully satisfied, including its `MEMORY/`
  record.
- Documentation-only edits (fixing a spec document with no code impact) may
  go directly to `main`.
- Commit subject: `P{phase}-{seq}: <imperative summary>`. Body may reference
  the documents implemented, e.g. `Implements docs/API/11-UPLOAD-API.md`.

## Every task names the documents it implements

A task without an `Implements:` list pointing at real files under `docs/` is
not ready to start -- go write or finish that document first. The reverse is
also true: a `docs/` file with "Draft specification" status and no task
referencing it is a document nobody has committed to actually building yet;
that's fine at the planning stage, but flag it before calling a phase done.

## Definition of Done (baseline, every task)

Unless a task's own Definition of Done says otherwise, every task must also:

1. Pass `lint` and `typecheck` (or the language-appropriate equivalents) with
   zero new warnings.
2. Have automated tests for the behavior it adds or changes, at the layer
   defined in `docs/TESTING/00-TEST-STRATEGY.md`.
3. Update the `docs/` file(s) it implements from "Draft specification" to
   "Final" (or explicitly note what remains open and why).
4. Add or update a record in `MEMORY/records/` describing what was built,
   any deviation from the spec and why, and anything a future task needs to
   know.
5. Update `TASKS/PROGRESS.md` in the same commit/PR that closes the task.

## Security-critical tasks

Any task that adds or changes a `:id`-scoped endpoint, a signed-URL code
path, or anything touching tenant isolation must additionally:

- Add an automated IDOR/BOLA test: an authenticated caller from Tenant/Project
  A requesting Tenant/Project B's resource ID must receive `404` (preferred)
  or `403`, never `200`. See `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`.
- Note the test's location in the task's `MEMORY/` record.

`docs/SECURITY/` as a whole has zero tolerance: a task that weakens a control
defined there may not be merged with an "I'll fix it later" note. Either the
spec document is wrong and gets corrected first (with a `MEMORY/DECISIONS.md`
entry explaining why), or the code conforms to it.

## Blocked tasks

If a task cannot proceed because a decision is missing, do not guess and
move on silently. Either:

- make the decision, write it into the relevant `docs/` file, and record it
  in `MEMORY/DECISIONS.md` if it was non-obvious, or
- mark the task `Blocked` in `TASKS/PROGRESS.md` with a one-line reason and
  move to the next unblocked task.

## For AI agents specifically

See the root `CLAUDE.md` / `AGENTS.md` for the full operating instructions.
In short: read `TASKS/PROGRESS.md` first, read every document a task's
`Implements:` list names before writing code, do not invent API shapes not
in `docs/API/`, and write the `MEMORY/` record before considering the task
finished -- an agent session that ends without one has left no trace for the
next session to pick up from.
