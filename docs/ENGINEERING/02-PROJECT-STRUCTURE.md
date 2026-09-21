# 02 - Project Structure

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 1 and 3 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

Fix where code lives, so that "where does this go?" has one answer rather
than one answer per session. The layout mirrors
`docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md`: a service boundary in the
architecture is a directory under `services/`, and anything shared across
that boundary is a package.

Confirmed by `P0-01`; the deployable topology is `ADR-017` and the build
model is `ADR-018`. A deviation from this layout is an ADR (`AGENTS.md`).

## The three tiers

| Tier | Directory | Deployable | May import |
|---|---|---|---|
| Services | `services/*` | yes | `packages/*` only |
| Applications | `apps/*` | yes | `packages/*` only |
| Packages | `packages/*` | no | other `packages/*` only |

The three rules that follow from this table, all enforced by
`dependency-cruiser` in CI:

1. **No `services/* -> services/*` edge.** Cross-service communication is an
   HTTP call against a published contract, using a client that lives in
   `packages/`. A direct import would make two deployables one deployable
   with extra steps, and would let one service's migration break another.
2. **No `packages/* -> services/*` edge.** A library that knows about a
   service is not a library.
3. **No cycles anywhere.** A cycle between packages means the boundary
   between them was drawn in the wrong place.

## Services

```
services/
├── api/                          # Every HTTP surface: /v1, /i delivery, admin, probes
└── worker/                       # Every queue consumer (ADR-017)
```

Each service has the same internal shape:

```
services/<service>/
├── src/
│   ├── modules/<module>/         # Domain modules (see below)
│   ├── middlewares/              # HTTP middlewares, this service only
│   ├── jobs/                     # BullMQ producers + consumers
│   ├── clients/                  # Typed clients for other services
│   ├── constants/                # Service-local constants
│   ├── app.ts                    # Composition: mount routes + middleware
│   └── server.ts                 # Entry: listen, health, signal handling
├── tests/
│   ├── integration/              # *.int.test.ts (Testcontainers)
│   └── e2e/                      # *.e2e.test.ts (compose stack)
├── package.json
├── tsconfig.json
└── Dockerfile
```

`app.ts` and `server.ts` are split deliberately: integration tests import
`app.ts` and never bind a port, which is what makes the API contract tests
fast and parallelizable.

## Domain modules

A module is a directory under `src/modules/` named for one domain concept,
containing the full vertical slice for it:

```
modules/asset/
├── asset.routes.ts
├── asset.controller.ts
├── asset.service.ts
├── asset.repository.ts
├── asset.schema.ts
├── asset.mapper.ts
├── asset.types.ts
├── asset.constants.ts
├── asset.service.test.ts
└── asset.mapper.test.ts
```

Why vertical, not `controllers/` + `services/` + `repositories/`:

- Almost every task in `TASKS/` touches one concept across every layer. A
  vertical slice makes that one directory instead of four, and makes the
  diff reviewable as one thing.
- Deleting a concept is deleting a directory, which is why dead code
  actually gets deleted.
- The layer suffix in the filename keeps the layer legible without a
  directory to carry it -- and makes the lint rules in section 23
  expressible as filename globs.

Rules:

- A module that exceeds ~8 files splits by sub-concept
  (`asset/`, `asset-version/`, `derivative/`), never into a `helpers/`
  directory.
- A module MUST NOT import another module's repository. Cross-module access
  goes `service -> service`.
- A module's `*.types.ts` may be imported freely; that is what it is for.

## Packages

```
packages/
├── config/             # Typed env loading + validation (P0-04)
├── errors/             # AppError hierarchy, error codes, ok()/created()
├── logger/             # pino factory, redaction list, request context
├── db/                 # Connection, pool, migrations, scoped() base repo
├── tenancy/            # TenantContext, permission types, scoping helpers
├── schema/             # Zod schemas shared across services
├── storage-adapter/    # StorageAdapter interface + S3 impl (ADR-001/002)
├── transform-params/   # Normalization + params_hash (ADR-004/009)
├── queue/              # Queue interface: BullMQ + in-memory (ADR-007)
├── cache/              # Cache interface: Redis + in-memory
├── image-engine/       # sharp/libvips pipeline, encoder settings (ADR-016)
├── signing/            # Signed-URL canonical string + HMAC (ADR-006)
└── test-utils/         # Factories, fixtures, isolation helpers
```

Rules:

- A package MUST NOT read `process.env`. It takes config as an argument.
  This is what lets a test construct one with three different
  configurations in one file.
- A package MUST NOT contain a rule specific to one service. If only
  `services/api` will ever call it, it belongs in `services/api`.
- A package exports through a single `src/index.ts` barrel. Deep imports
  into a package's internals are banned by lint -- the barrel is the
  package's contract.
- Each package has its own `package.json`, `tsconfig.json`, and tests, and
  typechecks independently. Packages have no build step: they export their
  TypeScript source, and the services' `tsup` bundles inline them
  (`ADR-018`). The SDKs under `sdks/` are the exception and build their own
  distributable output.
- `packages/transform-params` and `packages/storage-adapter` are the two
  packages with hard import restrictions pointing *at* them (section 23):
  they exist to be the only implementation of their concern.

## Applications

```
apps/
├── dashboard/          # Developer/admin UI, per docs/UI-UX/
└── website/            # Marketing site + documentation, per docs/WEBSITE/
```

The dashboard is a client of the public API contract, exactly like a
third-party consumer. It MUST NOT import `packages/db`, a repository, or a
service. If the dashboard needs something the public API cannot express,
the API gains it -- that is a feature every consumer then has, and it keeps
the dashboard honest about the contract's completeness.

## Repository root

```
image-delivery/
├── docs/                 # Specification (this file)
├── TASKS/                # Execution plan
├── MEMORY/               # ADRs + task records
├── deploy/               # docker-compose.yml, per-env manifests
├── packages/
├── services/
├── apps/
├── .editorconfig
├── .env.example          # Every variable, commented (section 19)
├── .nvmrc
├── eslint.config.js      # Flat config, shared by the workspace
├── package.json          # Root scripts fan out to every package
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
├── AGENTS.md             # Read first
├── CLAUDE.md
└── README.md
```

## Acceptance Criteria

- [x] Every directory in the tree has a stated owner concern and a stated
      import restriction.
- [x] The three import rules are machine-enforced (`dependency-cruiser`,
      `eslint-plugin-boundaries`) rather than documented only.
- [x] Names trace to `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md` and the
      package list in `TASKS/PHASE-0-FOUNDATION.md` `P0-01`.

## Open Questions

- Resolved by `P0-01`: two deployables, `services/api` and
  `services/worker` (`ADR-017`); search is a module inside `services/api`.
- None open.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (sections 1, 3)
- `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md` (which services exist)
- `docs/ARCHITECTURE/03-COMPONENT-ARCHITECTURE.md`
- `TASKS/PHASE-0-FOUNDATION.md` (`P0-01` scaffolds this layout)
