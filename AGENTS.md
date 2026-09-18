# AGENTS.md

Operating instructions for any AI coding agent (or human) working in this
repository. This file is the entry point -- read it before touching any
file. `CLAUDE.md` is a short pointer to this file plus Claude-specific
notes; the two must never contradict each other.

## What this repository is

The specification and execution plan for an **Image Management & Delivery
Platform** (an "Image Infrastructure API" in the style of Cloudinary /
imgix / Thumbor): a platform other applications call over HTTP to upload,
store, transform, and deliver images, without ever knowing what storage
backend sits underneath. Core promise, repeated throughout `docs/`:

```
Asset Storage != Image Processing != Image Delivery != Consumer Application
```

At the point this repository was generated, **no application code exists
yet** -- only the specification (`docs/`), the execution plan (`TASKS/`),
and the decision/record log (`MEMORY/`). An agent's job, task by task, is to
turn `docs/` into the real system `TASKS/` describes, while keeping all
three directories in sync with what actually gets built.

## Where things are

| Path | What it holds |
|---|---|
| `docs/` | **The specification.** 318 documents across 22 categories: product, architecture, API contract, database schema, the image delivery protocol, image processing, storage, multi-tenancy, security, CDN, search, SDKs, webhooks, observability, performance, DevOps, testing, dashboard UI, developer docs, engineering conventions, the public website. Every document starts life as "Draft specification" and is flipped to "Final" by the task that implements it. |
| `TASKS/` | **The execution plan.** 78 tasks across 8 phases (`P0`-`P7`), each naming the `docs/` files it implements and its Definition of Done. Start at `TASKS/PROGRESS.md`. Conventions in `TASKS/00-TASK-CONVENTIONS.md` are mandatory, not optional reading. |
| `MEMORY/` | **The record.** `MEMORY/DECISIONS.md` is the ADR log (already seeded with the foundational decisions implied by the spec). `MEMORY/records/` holds one file per completed task -- required by the Definition of Done, not optional documentation. |
| (not yet created) | Application code. As Phase 0 tasks execute, this repository will grow `backend/` (or per-service packages), `frontend/` or `dashboard/`, and `packages/` for shared code, per the layout implied by `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md` and `TASKS/PHASE-0-FOUNDATION.md` P0-01. Do not invent a different layout without recording why in `MEMORY/DECISIONS.md`. |

## The loop every agent session should follow

1. **Read `TASKS/PROGRESS.md`.** Find the next `Not started` task in the
   earliest phase that has one, whose `Depends on` tasks are all `Done`.
2. **Read `docs/ENGINEERING/00-CODING-CONTEXT.md`** before writing the
   first line of code in a session. It is one page, and it is where the
   stack, the directory layout, the layering rule, the naming table, and
   the five non-negotiable code rules live. `docs/ENGINEERING/01-CODING-STANDARDS.md`
   is the detailed version to open while writing a specific file.
3. **Read every document that task's `Implements:` list names, in full.**
   Do not start writing code from memory of what a similar platform "should"
   look like -- the specification in this repo is the one that governs,
   and it has already made specific choices (see `MEMORY/DECISIONS.md`)
   that a generic implementation would get wrong.
4. **Read the `MEMORY/records/` file for every task this one depends on.**
   Decisions and gotchas recorded there are not repeated in `docs/` or
   `TASKS/` -- this is the one place institutional memory lives across
   sessions.
5. **Do the work** against the task's own Steps and Definition of Done,
   plus the baseline Definition of Done in `TASKS/00-TASK-CONVENTIONS.md`.
6. **Update the `docs/` files** the task implements from "Draft
   specification" to "Final" (or note explicitly what's still open).
7. **Write `MEMORY/records/{TASK-ID}.md`** using
   `MEMORY/records/TEMPLATE.md`. Add a `MEMORY/DECISIONS.md` entry if a
   real, non-obvious fork in the road was resolved.
8. **Update `TASKS/PROGRESS.md`** in the same change.
9. If truly blocked (a decision is missing that this task cannot make
   alone), mark the task `Blocked (<reason>)` in `PROGRESS.md` and move to
   the next unblocked task rather than guessing and moving on silently.

## Hard rules

- **Never invent an API shape not in `docs/API/`.** If a task needs an
  endpoint the spec doesn't define precisely enough, write the missing
  precision into the relevant `docs/API/*.md` file first, in the same
  change, then implement it.
- **Never weaken a `docs/SECURITY/` or `docs/MULTI-TENANCY/` control** to
  make a task easier. If the spec and a shortcut conflict, the spec wins
  until it is deliberately changed (with a `MEMORY/DECISIONS.md` entry
  explaining why), not silently worked around.
- **Every `:id`-scoped endpoint needs an IDOR/BOLA test** proving a foreign
  tenant's ID returns `404`, per `TASKS/00-TASK-CONVENTIONS.md`. This is
  not optional for "simple" endpoints.
- **One task at a time, in dependency order.** Don't jump ahead to a task
  whose dependencies aren't `Done` even if the code looks independent --
  the dependency usually encodes an assumed-settled decision (schema shape,
  interface signature) the later task relies on.
- **Write code the way `docs/ENGINEERING/` says to.** The layering rule,
  the `TenantContext`-first signature, the single normalization function,
  and the error/response envelope are not stylistic preferences -- each one
  is how an ADR in `MEMORY/DECISIONS.md` stays true after the session that
  made it ends. Deviating is an ADR, not a judgment call.
- **Don't silently expand scope.** A task's Steps are the task; if you
  notice unrelated cleanup or a missing feature while working, either open
  it as a new row in the relevant `TASKS/PHASE-*.md` file (don't just do it
  inline) or note it in the `MEMORY/` record as a follow-up.

## Recommended default stack

`docs/` and `TASKS/` are written assuming (and this repo's ADRs in
`MEMORY/DECISIONS.md` record the reasoning for) the following defaults. An
agent may propose a different stack, but doing so is itself an ADR-worthy
decision -- write it into `MEMORY/DECISIONS.md` before diverging, don't just
diverge silently:

- **Language / runtime:** TypeScript on Node.js LTS, workspace-managed
  (pnpm workspaces + a task runner such as Turborepo), one package per
  service per `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md`.
- **Database:** PostgreSQL, migrations via a standard migration tool
  (Prisma / Drizzle / Knex -- pick one in `P0-06` and record it).
- **Cache / queue:** Redis, with a queue library (BullMQ or equivalent) for
  the processing and webhook-delivery workers.
- **Image processing:** `sharp` (libvips-based) -- see ADR-{n/a, record
  when chosen in `P3-01`}.
- **Object storage:** an S3-compatible adapter (works against AWS S3,
  Cloudflare R2, and MinIO for local dev) per ADR-002.
- **Local infra:** Docker Compose (Postgres, Redis, MinIO).
- **CDN:** provider chosen and recorded in `P4-01`.

## For Claude specifically

See `CLAUDE.md`. It is intentionally short and defers here for everything
substantive, so the two files cannot drift out of sync on the rules that
matter.
