# 10 - Tooling, Lint & Format

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

Expands section 23 of [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md).

## Purpose

A convention a machine checks is a convention; a convention only a reviewer
checks is a suggestion. This document specifies which rules in this category
are mechanically enforced, and how. The architectural lint rules matter most:
they are how ADR-001, ADR-004, and ADR-005 stay true after the session that
wrote them ends.

## Commands

Identical locally and in CI. A rule that only runs in CI gets discovered at
the worst moment; a rule that only runs locally does not exist.

```bash
pnpm install --frozen-lockfile
pnpm lint            # eslint --max-warnings=0
pnpm format:check    # prettier --check
pnpm typecheck       # tsc --noEmit, every package
pnpm test            # vitest run (unit + integration)
pnpm test:coverage   # with the thresholds from doc 09 enforced
pnpm build           # every package
pnpm deps:check      # dependency-cruiser boundary + cycle rules
pnpm audit:deps      # dependency vulnerabilities, blocking at high (P0-10)
pnpm scan:secrets    # gitleaks over the full history (P0-10)
pnpm verify          # format:check, lint, typecheck, deps:check, test:unit, build
```

`pnpm lint && pnpm typecheck && pnpm test` is the baseline Definition of
Done for every task (`TASKS/00-TASK-CONVENTIONS.md`). "Zero new warnings" is
literal: `--max-warnings=0`, so a warning fails the build. A warning nobody
must fix accumulates until the output is unreadable, at which point real
findings hide in it.

## ESLint

Flat config at the root (`eslint.config.js`), shared by every package, with
per-glob overrides for the layering rules. Base: `typescript-eslint`
`strictTypeChecked` (type information through the project service) and
`eslint-plugin-import-x`. Module-boundary rules live in dependency-cruiser,
not in an ESLint boundaries plugin: they are properties of the graph, and
one tool owning them avoids two configs that drift.

**Proof that the rules fire.** `tools/tests/lint-rules.test.ts` lints a
violating snippet for every architectural rule *as if* it lived at a real
path, through this config, and asserts the rule's message; it also asserts
the rules stay silent where the code belongs (the storage adapter may import
an SDK). `tools/tests/depcruise-rules.test.ts` does the same for every
dependency-cruiser rule against a planted fixture tree. Both run in
`test:unit`, so a config edit that silently disables a rule fails CI.

**How `no-restricted-imports` blocks compose.** ESLint *replaces* a rule's
options when two config blocks match one file; it does not merge them. So
each file set (controllers/routes, services, repositories, everything else)
has one block restating every import restriction that applies to it. Adding
a restriction means adding it to each block whose files it covers.

### Architectural rules

Each of these prevents a specific failure this specification names. They are
not style.

```js
// Controllers (and Fastify route files) may not reach past the service layer.
{
  files: ["services/*/src/**/*.controller.ts", "services/*/src/**/*.routes.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["**/*.repository", "**/*.repository.js"],
          message: "Controllers call services, not repositories. See ENGINEERING/01 section 6." },
        { group: ["@image-delivery/db", "@image-delivery/db/*"],
          message: "Controllers must not touch the query layer. ADR-005." },
      ],
    }],
  },
}

// Services must stay reusable by workers: no HTTP types.
{
  files: ["**/*.service.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "fastify", message: "Services must not know about HTTP; workers reuse them. See ENGINEERING/01 section 8." },
      ],
      patterns: [
        { group: ["**/http/*", "**/middlewares/*"],
          message: "A service that needs middleware is doing controller work." },
      ],
    }],
  },
}

// The storage abstraction must not leak (ADR-001).
{
  files: ["**/*.ts"],
  ignores: ["packages/storage-adapter/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@aws-sdk/*", "@azure/storage-blob", "@google-cloud/storage", "minio",
                  "ssh2-sftp-client", "webdav"],
          message: "Provider SDKs live only in packages/storage-adapter. ADR-001." },
      ],
    }],
  },
}

// One params-hash implementation (ADR-004/009). The one other legitimate
// createHash (the SFTP adapter's host-key fingerprint) carries an inline
// eslint-disable with its reason, so the exception is visible where it is.
{
  files: ["**/*.ts"],
  ignores: ["packages/transform-params/**"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "node:crypto", importNames: ["createHash"],
          message: "Hashing transformation params happens only in packages/transform-params. ADR-004." },
      ],
    }],
  },
}

// Structured logging only.
{
  files: ["services/**/*.ts", "packages/**/*.ts"],
  ignores: ["**/*.test.ts", "**/scripts/**"],
  rules: {
    "no-restricted-syntax": ["error", {
      selector: "MemberExpression[object.name='console']",
      message: "Use the logger from @image-delivery/logger. See ENGINEERING/12.",
    }],
  },
}

// The unscoped escape hatch is not available to normal service code.
{
  files: ["services/*/src/**/*.service.ts", "services/*/src/modules/**/*.repository.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "@image-delivery/db", importNames: ["unsafeUnscoped"],
          message: "unsafeUnscoped is for admin and maintenance contexts only. ADR-005." },
      ],
    }],
  },
}
```

Each message names the document or ADR, so the rule teaches rather than just
blocks. A developer who hits a rule and cannot find out why will disable it.

### Correctness rules (errors, not warnings)

| Rule | Prevents |
|---|---|
| `@typescript-eslint/no-explicit-any` | Untyped boundaries |
| `@typescript-eslint/no-unsafe-assignment`, `-argument`, `-return`, `-member-access` | `any` leaking in from untyped dependencies |
| `@typescript-eslint/no-floating-promises` | A dropped job enqueue or cache invalidation |
| `@typescript-eslint/no-misused-promises` | An `async` handler whose rejection vanishes |
| `@typescript-eslint/await-thenable` | `await` on a non-promise, hiding a missing call |
| `@typescript-eslint/no-non-null-assertion` | Unchecked claims about `undefined` |
| `@typescript-eslint/consistent-type-imports` | Runtime imports of type-only modules |
| `@typescript-eslint/switch-exhaustiveness-check` | An unhandled state in a discriminated union |
| `@typescript-eslint/no-unnecessary-condition` | Dead checks that hide a real one |
| `no-restricted-syntax` on `TSEnumDeclaration` | `enum` (see doc 04) |
| `import-x/no-default-export` | Inconsistent import names (off only for tool configs whose loader requires one) |
| `import-x/order` (configured groups) | Diff noise in every pull request |
| `eqeqeq`, `no-param-reassign`, `prefer-const` | Ordinary footguns |

Import cycles are dependency-cruiser's `no-circular`, not
`import-x/no-cycle`: the latter re-walks the module graph per file and
doubled lint time for the same guarantee.

`@typescript-eslint/require-await` is **off**, deliberately: an `async`
function implementing a Promise-returning interface (a storage adapter
method, a readiness check, a test stub) turns a synchronous throw into a
rejection, which is the contract the caller relies on.

### Test-file relaxations

In `**/*.test.ts` and `**/tests/**`: `no-explicit-any` and the `no-unsafe-*`
family are warnings, since stub construction sometimes needs them. With
`--max-warnings=0` a warning still fails the build; the distinction only
marks these as the rules most likely to deserve an inline, explained
disable in a test. Nothing else is
relaxed -- and never the architectural rules, because a test importing a
repository from a controller test is usually the first sign the production
code is about to.

## dependency-cruiser

ESLint sees one file at a time; the module graph needs its own check.

```js
// .dependency-cruiser.cjs -- forbidden rules (abridged; the file is canonical)
[
  { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  { name: "no-service-to-service", severity: "error",
    from: { path: "^services/([^/]+)/" },
    to:   { path: "^services/(?!$1)([^/]+)/" } },
  { name: "no-package-to-service", severity: "error",
    from: { path: "^packages/" }, to: { path: "^services/" } },
  { name: "no-app-to-internals", severity: "error",
    from: { path: "^apps/" },
    to:   { path: "(^packages/db|\\.repository\\.ts$|\\.service\\.ts$)" } },
  { name: "no-deep-package-import", severity: "error",
    from: { path: "^(services|apps|sdks)/" },
    to:   { path: "^packages/[^/]+/src/", dependencyTypes: ["local"] } },
  { name: "not-to-unresolvable", severity: "error",
    from: {}, to: { couldNotResolve: true } },
]
```

`no-deep-package-import` matches only *relative* paths into a package: an
import by package name is already limited to the package's `exports` map
(including declared subpaths such as `@image-delivery/storage-adapter/s3`),
and a non-exported one fails to resolve. `no-orphans` is not enabled: under
zero tolerance a warning-level rule is either an error or noise, and a
freshly scaffolded package is legitimately orphaned.

`pnpm deps:check` runs `scripts/deps-check.mjs`, which cruises every
workspace root that exists (`apps/` and `sdks/` arrive in later phases).

`no-app-to-internals` is what keeps the dashboard an honest client of the
public API (see [`02-PROJECT-STRUCTURE.md`](./02-PROJECT-STRUCTURE.md)).
`no-deep-package-import` is what makes a package's `index.ts` a real
contract rather than a convention.

## Prettier

Prettier owns all formatting of code and config, and nobody discusses it in
review. It does **not** format Markdown (`.prettierignore`): re-aligning
every table across the 300+ specification documents would bury real spec
changes in whitespace diffs. Markdown line endings and final newlines are
still governed by `.editorconfig` and `.gitattributes`.

```jsonc
{
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

`endOfLine: "lf"` plus `.gitattributes` with `* text=auto eol=lf` -- the team
develops on Windows and Linux, and a CRLF-only diff is the noisiest possible
pull request.

ESLint carries no stylistic rules; there is no `eslint-config-prettier`
conflict to manage because no formatting rule is enabled in the first place.

## Git hooks

- **pre-commit** -- `lint-staged`: Prettier and ESLint `--fix` on staged
  files only. Fast, so it does not train people to use `--no-verify`.
- **commit-msg** -- `scripts/commit-msg.mjs` validates the
  `P{phase}-{seq}: <summary>` subject from `TASKS/00-TASK-CONVENTIONS.md`
  (also `fix:` / `chore:` / `docs:` for work outside a task, `wip:` for
  branch-local commits that are squashed away, and git's own Merge/Revert
  subjects). A commit that cannot be traced to a task loses the join key the
  whole plan is built on. Tested in `tools/tests/commit-msg.test.ts`.
- **pre-push** -- `typecheck` only. Full tests belong in CI; a slow pre-push
  hook gets bypassed.

Hooks are installed by `simple-git-hooks` on `pnpm install` (`prepare`) and
configured in the root `package.json`. They are a convenience. CI is the
gate, and CI never trusts that a hook ran.

## CI pipeline

Per `docs/DEVOPS/02-CI-CD.md`; the ordering principle is fail fast, cheapest
first:

1. install (frozen lockfile)
2. `format:check`, `lint`, `typecheck`, `deps:check` -- sequential steps of
   the `verify` job, cheapest first
3. unit tests
4. build
5. integration tests (Testcontainers: Postgres, Redis, MinIO) **with the
   coverage thresholds**, in one run, in the `integration` job after
   `verify` -- the thresholds are over unit + integration together
6. the conformance and golden-vector suites (added by the tasks that
   write them)
7. `audit` + secret scan: the `security` job, in parallel with `verify`
   (`P0-10`)

Every step is required. A step that can be skipped on a red build is not a
gate, and `TASKS/00-TASK-CONVENTIONS.md` does not permit "I'll fix it later"
on any of them.

## Editor

`.editorconfig` mirrors Prettier: LF, UTF-8, 2 spaces, final newline, trim
trailing whitespace. `.vscode/extensions.json` recommends the ESLint and
Prettier extensions with format-on-save, so the hook has nothing to do by
the time a commit happens.

## Acceptance Criteria

- [x] Every architectural rule in this category is expressed as a concrete
      lint or dependency-cruiser rule with a message naming its document.
- [x] The commands are identical locally and in CI, and `--max-warnings=0`
      makes "zero new warnings" mechanical.
- [x] Formatting is fully delegated, so no review comment can be about it.

## Open Questions

- Resolved: the HTTP framework in the `*.service.ts` restriction is
  `fastify` (`P0-08`, ADR-020).
- Whether the `:id`-route isolation-test gate (doc 09, suite 1) is
  implemented as a lint rule here or as a runtime router check is decided in
  `P1-06`.
- Resolved: `P0-10` picked `pnpm audit` and gitleaks (plus CodeQL); see
  `docs/DEVOPS/02-CI-CD.md`.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 23)
- `docs/ENGINEERING/04-TYPESCRIPT-STANDARDS.md` (the flags these rules back up)
- `docs/ENGINEERING/02-PROJECT-STRUCTURE.md` (the boundaries being enforced)
- `docs/DEVOPS/02-CI-CD.md` (the pipeline)
- `TASKS/PHASE-0-FOUNDATION.md` (`P0-03` CI, `P0-10` security scan)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-004`, `ADR-005`)
