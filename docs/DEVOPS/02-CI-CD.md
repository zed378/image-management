# 02 - CI/CD

> Category: **DevOps** (`docs/DEVOPS/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The pipeline's stages, what each one proves, and which ones block a merge.
The stage names below are the literal job and step names in
`.github/workflows/ci.yml`; if the two ever disagree, the workflow is
correct and this document is the bug.

## Category Mandate

Environments, containerization, CI/CD, configuration and secrets management,
migrations, backup/restore, and disaster recovery.

---

## Provider

GitHub Actions, on the `zed378/image-management` repository. Triggered on
every push to `main`, `feat/**`, `fix/**`, `chore/**`, and on every pull
request. A newer push to the same ref cancels the older run
(`concurrency: ci-<ref>`).

## Jobs and steps

Ordered cheapest-first, so a failure surfaces as early as possible.

### Job `verify` -- blocks merge

| Step | Command | Proves |
|---|---|---|
| `install` | `pnpm install --frozen-lockfile` | The lockfile matches every `package.json`; nothing resolves differently in CI than locally |
| `lint` | `pnpm lint` | ESLint with `--max-warnings=0`; a warning is a failure |
| `typecheck` | `pnpm typecheck` | Every package and service typechecks under `tsconfig.base.json`'s strict flags |
| `unit tests` | `pnpm test:unit` | The `unit` Vitest project |
| `build` | `pnpm build` | Both deployables bundle |

### Job `integration` -- blocks merge, runs after `verify`

| Step | Command | Proves |
|---|---|---|
| `install` | `pnpm install --frozen-lockfile` | as above |
| `integration tests (Testcontainers)` | `pnpm test:integration` | The `integration` Vitest project against real PostgreSQL, Redis, and MinIO started by Testcontainers on the runner's Docker daemon |

`integration` depends on `verify` (`needs: verify`) rather than running in
parallel: it is the slow job, and there is no value in paying for it on a
commit that does not typecheck.

### Added by later tasks

These slot into `verify` in fail-fast order and are documented by the tasks
that add them:

| Task | Adds |
|---|---|
| `P0-10` | Dependency audit and secret scan (a separate `security` job) |
| `P0-11` | `format:check` and `deps:check`; architectural lint rules; coverage thresholds |
| `P1-06` | The IDOR/BOLA route-coverage gate |
| `P4-08` | The protocol conformance suite |

## Local parity

Every step is a root `package.json` script, so the pipeline is reproducible
locally with the same commands:

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build
pnpm test:integration   # needs a running Docker daemon
```

A check that only runs in CI gets discovered at the worst moment; a check
that only runs locally does not exist (`docs/ENGINEERING/10`).

## Branch protection (applied out of band)

A repository admin must configure, on `main`:

- required status checks: `verify` and `integration`;
- require branches to be up to date before merging;
- no force pushes, no deletion.

The workflow cannot set these itself; they are GitHub repository settings.
Until they are applied, the checks run but do not technically block a merge,
and the `TASKS/00-TASK-CONVENTIONS.md` rule that a task merges only when its
Definition of Done is met is enforced by process rather than by GitHub.

## Delivery (CD)

Not automated in v1. The deployable artifact is the container image built
by `deploy/Dockerfile` (`01-CONTAINERIZATION.md`); publishing it to a
registry and rolling it out are tied to the hosting choice, which is outside
the v1 task plan (`00-ENVIRONMENT.md`, open questions).

## Acceptance Criteria

- [x] Every stage named here matches `.github/workflows/ci.yml` literally.
- [x] Each stage states what it proves, and whether it blocks merge.
- [x] CI is green on the scaffold, verified by an actual GitHub Actions run
      (recorded in `MEMORY/records/P0-03.md`).
- [x] Local commands reproduce every CI step.

## Open Questions

- Branch protection must be applied by a repository admin.
- Turborepo remote caching would cut `typecheck`/`build` time once the
  workspace grows; not needed at current size.

## Related Documents

- `.github/workflows/ci.yml`
- `docs/DEVOPS/00-ENVIRONMENT.md`, `01-CONTAINERIZATION.md`
- `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md`
- `TASKS/00-TASK-CONVENTIONS.md`
