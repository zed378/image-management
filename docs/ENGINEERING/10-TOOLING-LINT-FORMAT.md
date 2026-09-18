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
pnpm audit           # dependency vulnerabilities (P0-10)
```

`pnpm lint && pnpm typecheck && pnpm test` is the baseline Definition of
Done for every task (`TASKS/00-TASK-CONVENTIONS.md`). "Zero new warnings" is
literal: `--max-warnings=0`, so a warning fails the build. A warning nobody
must fix accumulates until the output is unreadable, at which point real
findings hide in it.

## ESLint

Flat config at the root (`eslint.config.js`), shared by every package, with
per-glob overrides for the layering rules. Base: `typescript-eslint`
strict + type-checked, `import`, `boundaries`, `vitest`, `unicorn`
(selectively).

### Architectural rules

Each of these prevents a specific failure this specification names. They are
not style.

```js
// Controllers may not reach past the service layer.
{
  files: ["**/*.controller.ts"],
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
        { name: "express", message: "Services must not know about HTTP. See ENGINEERING/01 section 8." },
      ],
      patterns: [
        { group: ["**/middlewares/*"],
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
        { group: ["@aws-sdk/*", "@google-cloud/storage", "@azure/storage-blob", "minio"],
          message: "Provider SDKs live only in packages/storage-adapter. ADR-001." },
      ],
    }],
  },
}

// One params-hash implementation (ADR-004/009).
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
  files: ["services/*/src/modules/**/*.ts"],
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
| `import/no-default-export` | Inconsistent import names |
| `import/no-cycle` | Import cycles |
| `import/order` (configured groups) | Diff noise in every pull request |
| `eqeqeq`, `no-param-reassign`, `prefer-const` | Ordinary footguns |

### Test-file relaxations

In `**/*.test.ts`: `no-explicit-any` and the `no-unsafe-*` family are
warnings, since stub construction sometimes needs them. Nothing else is
relaxed -- and never the architectural rules, because a test importing a
repository from a controller test is usually the first sign the production
code is about to.

## dependency-cruiser

ESLint sees one file at a time; the module graph needs its own check.

```js
// .dependency-cruiser.js -- forbidden rules
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
    from: { path: "^(services|apps)/" },
    to:   { path: "^packages/[^/]+/src/(?!index)" } },
  { name: "no-orphans", severity: "warn", from: { orphan: true }, to: {} },
]
```

`no-app-to-internals` is what keeps the dashboard an honest client of the
public API (see [`02-PROJECT-STRUCTURE.md`](./02-PROJECT-STRUCTURE.md)).
`no-deep-package-import` is what makes a package's `index.ts` a real
contract rather than a convention.

## Prettier

Prettier owns all formatting, and nobody discusses it in review.

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
- **commit-msg** -- validates the `P{phase}-{seq}: <summary>` subject from
  `TASKS/00-TASK-CONVENTIONS.md`. A commit that cannot be traced to a task
  loses the join key the whole plan is built on.
- **pre-push** -- `typecheck` only. Full tests belong in CI; a slow pre-push
  hook gets bypassed.

Hooks are a convenience. CI is the gate, and CI never trusts that a hook ran.

## CI pipeline

Per `docs/DEVOPS/02-CI-CD.md`; the ordering principle is fail fast, cheapest
first:

1. install (frozen lockfile)
2. `format:check`, `lint`, `typecheck`, `deps:check` -- in parallel
3. unit tests
4. integration tests (Testcontainers: Postgres, Redis, MinIO)
5. coverage thresholds
6. the conformance and golden-vector suites
7. `audit` + secret scan (`P0-10`)
8. build

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

- The exact HTTP framework name in the `*.service.ts` restriction is filled
  in by `P0-08`.
- Whether the `:id`-route isolation-test gate (doc 09, suite 1) is
  implemented as a lint rule here or as a runtime router check is decided in
  `P1-06`.
- `P0-10` picks the secret-scanning and dependency-audit tools; step 7 above
  is the slot they occupy.

## Related Documents

- `docs/ENGINEERING/01-CODING-STANDARDS.md` (section 23)
- `docs/ENGINEERING/04-TYPESCRIPT-STANDARDS.md` (the flags these rules back up)
- `docs/ENGINEERING/02-PROJECT-STRUCTURE.md` (the boundaries being enforced)
- `docs/DEVOPS/02-CI-CD.md` (the pipeline)
- `TASKS/PHASE-0-FOUNDATION.md` (`P0-03` CI, `P0-10` security scan)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-004`, `ADR-005`)
