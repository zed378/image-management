# TASKS -- The Execution Plan

This is the plan that turns `docs/` into a running platform: 78 tasks across
8 phases, each naming exactly which documents it implements and how it is
judged done.

**Start at [`PROGRESS.md`](./PROGRESS.md).** It is the live status board.
Read [`00-TASK-CONVENTIONS.md`](./00-TASK-CONVENTIONS.md) before starting
any task -- it defines the baseline Definition of Done every task must meet,
branch/commit conventions, and the security-critical-task extra requirements
(IDOR/BOLA tests) that apply throughout.

## Phases

| Phase | File | Goal |
|---|---|---|
| 0 | [`PHASE-0-FOUNDATION.md`](./PHASE-0-FOUNDATION.md) | Repo, CI, local infra, storage abstraction, core schema skeleton. |
| 1 | [`PHASE-1-TENANCY-AUTH.md`](./PHASE-1-TENANCY-AUTH.md) | Full data model, API keys, RBAC, tenant isolation proven by tests. |
| 2 | [`PHASE-2-ASSET-STORAGE.md`](./PHASE-2-ASSET-STORAGE.md) | Asset CRUD, upload paths, versioning, folders/tags/collections. |
| 3 | [`PHASE-3-PROCESSING-TRANSFORMATION.md`](./PHASE-3-PROCESSING-TRANSFORMATION.md) | The transformation pipeline: resize/crop/fit/format/quality/DPR. |
| 4 | [`PHASE-4-DELIVERY-CDN.md`](./PHASE-4-DELIVERY-CDN.md) | CDN, cache keys, invalidation, delivery performance. |
| 5 | [`PHASE-5-SECURITY-HARDENING.md`](./PHASE-5-SECURITY-HARDENING.md) | Visibility levels, signed URLs, rate limiting, abuse prevention. |
| 6 | [`PHASE-6-SEARCH-WEBHOOKS-SDK-DASHBOARD.md`](./PHASE-6-SEARCH-WEBHOOKS-SDK-DASHBOARD.md) | Search, webhooks, SDKs, the developer/admin dashboard. |
| 7 | [`PHASE-7-OBSERVABILITY-PERFORMANCE-LAUNCH.md`](./PHASE-7-OBSERVABILITY-PERFORMANCE-LAUNCH.md) | Observability, quota enforcement, load testing, launch readiness. |

## Why phases are ordered this way

Tenancy and auth (Phase 1) come before any asset feature because retrofitting
isolation into existing endpoints is far more error-prone than building every
endpoint against an isolation-enforcing base layer from the start. Processing
(Phase 3) comes before CDN (Phase 4) because caching a wrong or
non-deterministic transformation just makes the bug harder to see. Security
hardening (Phase 5) is its own phase, after core features exist, because
signed URLs and rate limiting need real endpoints to protect -- but it is
**not** the only place security work happens: Phase 1 already enforces
tenant isolation, and every phase's tasks carry the IDOR/BOLA obligation from
`00-TASK-CONVENTIONS.md` throughout.

## Working the board

1. Pick the next `Not started` task in the earliest phase with one, whose
   `Depends on` list is fully `Done`.
2. Branch `feat/P{phase}-{seq}-kebab-case-summary`.
3. Read every document under `Implements:` before writing code.
4. Do the work, satisfying both the task's own Definition of Done and the
   baseline one in `00-TASK-CONVENTIONS.md`.
5. Write the `MEMORY/records/P{phase}-{seq}.md` record.
6. Update `PROGRESS.md` and open the PR in the same change.
