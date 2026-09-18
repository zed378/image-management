# CLAUDE.md

This file is a short pointer for Claude. **The full operating instructions
live in [`AGENTS.md`](./AGENTS.md) -- read that file in full before doing
anything else in this repository.** Everything in `AGENTS.md` applies to
Claude with no exceptions; this file only adds Claude-specific notes so the
two never need to say the same thing twice and risk drifting apart.

## Quick orientation

- `docs/` -- the specification (318 documents, 22 categories). Start with
  `docs/README.md`.
- `TASKS/` -- the execution plan (78 tasks, 8 phases). Start with
  `TASKS/PROGRESS.md`, and read `TASKS/00-TASK-CONVENTIONS.md` before the
  first task of any session.
- `docs/ENGINEERING/` -- how code is written here. Read
  `docs/ENGINEERING/00-CODING-CONTEXT.md` (one page) before writing code;
  open `01-CODING-STANDARDS.md` while writing a specific file.
- `MEMORY/` -- the record. `MEMORY/DECISIONS.md` for why things are the way
  they are; `MEMORY/records/{TASK-ID}.md` for what happened on each task.

## Claude-specific working notes

- **Use extended thinking / planning before large multi-file changes.**
  Most tasks in `TASKS/` touch a `docs/` file, application code, and a test
  suite in the same change -- plan the full diff before writing the first
  file so the `docs/` update and the code don't drift from each other
  mid-task.
- **When a task's `Implements:` list is long, read every document before
  writing any code**, not just the first one. The image-processing and
  security documents in particular assume the reader has internalized
  cross-file constraints (e.g. a transformation parameter defined in
  `docs/API/13-IMAGE-TRANSFORMATION-API.md` must match the normalization
  function referenced by `docs/CDN/01-CACHE-KEY.md` and
  `docs/STORAGE/04-OBJECT-NAMING.md` exactly -- see `MEMORY/DECISIONS.md`
  ADR-004).
- **Prefer editing an existing "Draft specification" doc over creating a
  new one.** Every document this platform needs already has a file under
  `docs/`; if something seems missing, it's more likely under-specified in
  an existing file than genuinely absent.
- **Treat `TASKS/00-TASK-CONVENTIONS.md`'s security-critical-task rules
  (IDOR/BOLA tests) as non-negotiable**, even under time pressure or a
  request to "just get it working first." A shortcut here is the single
  most expensive kind of shortcut this specific platform can take, given
  it's explicitly multi-tenant.
- **Write the `MEMORY/records/{TASK-ID}.md` file before considering a task
  done.** A future Claude session has no memory of this one; the record is
  the only thing that carries context forward.
- If asked to work outside the `TASKS/` plan (an ad hoc request not tied to
  a task ID), it's fine -- just don't let ad hoc work silently violate a
  `docs/SECURITY/` or `docs/MULTI-TENANCY/` rule, and still consider
  whether it belongs as a new row in a `TASKS/PHASE-*.md` file rather than
  a one-off, unrecorded change.
