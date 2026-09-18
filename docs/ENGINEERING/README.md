# Engineering Conventions

How code in this repository is written, laid out, named, layered, tested,
logged, and reviewed. `docs/` elsewhere specifies **what** the platform
does; this category specifies **how** it is built, so that 74 tasks
executed by different people and different agent sessions produce one
codebase instead of eight dialects of one.

Two documents carry most of the weight:

- [`00-CODING-CONTEXT.md`](./00-CODING-CONTEXT.md) -- the compact master
  reference. Read this first, every session. It is the one file that fits
  in a single read and still tells you where everything is, which layer
  may call which, and what the five non-negotiable rules are.
- [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md) -- the detailed,
  numbered standard, with a copy-pasteable template for every layer. This
  is the reference you open while writing a specific file.

The remaining documents expand one section of `01` each, for when the
summary there is not enough.

## Documents

- [`00-CODING-CONTEXT.md`](./00-CODING-CONTEXT.md) -- Coding Context (master reference for agents)
- [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md) -- Coding Standards & Guidelines
- [`02-PROJECT-STRUCTURE.md`](./02-PROJECT-STRUCTURE.md) -- Project Structure
- [`03-NAMING-CONVENTIONS.md`](./03-NAMING-CONVENTIONS.md) -- Naming Conventions
- [`04-TYPESCRIPT-STANDARDS.md`](./04-TYPESCRIPT-STANDARDS.md) -- TypeScript Standards
- [`05-LAYER-TEMPLATES.md`](./05-LAYER-TEMPLATES.md) -- Layer Templates
- [`06-ERROR-RESPONSE-STANDARDS.md`](./06-ERROR-RESPONSE-STANDARDS.md) -- Error & Response Standards
- [`07-REPOSITORY-DATABASE-STANDARDS.md`](./07-REPOSITORY-DATABASE-STANDARDS.md) -- Repository & Database Standards
- [`08-CACHE-QUEUE-STANDARDS.md`](./08-CACHE-QUEUE-STANDARDS.md) -- Cache & Queue Standards
- [`09-TESTING-CONVENTIONS.md`](./09-TESTING-CONVENTIONS.md) -- Testing Conventions
- [`10-TOOLING-LINT-FORMAT.md`](./10-TOOLING-LINT-FORMAT.md) -- Tooling, Lint & Format
- [`11-GIT-REVIEW-CONVENTIONS.md`](./11-GIT-REVIEW-CONVENTIONS.md) -- Git & Review Conventions
- [`12-LOGGING-CONVENTIONS.md`](./12-LOGGING-CONVENTIONS.md) -- Logging Conventions
- [`13-SECURITY-CODING-RULES.md`](./13-SECURITY-CODING-RULES.md) -- Security Coding Rules
- [`14-CODE-REVIEW-CHECKLIST.md`](./14-CODE-REVIEW-CHECKLIST.md) -- Code Review Checklist

## Relationship to the rest of the repository

| This category defers to | For |
|---|---|
| `docs/API/01-API-STANDARDS.md`, `docs/API/05-ERROR-HANDLING.md` | The normative wire contract. Envelope shapes shown here are the *code-side* pattern; `P0-09` ratifies them into `docs/API/`. |
| `docs/ARCHITECTURE/02-SERVICE-BOUNDARIES.md` | Which services exist and what each owns. `P0-01` finalizes the package names. |
| `docs/SECURITY/`, `docs/MULTI-TENANCY/` | The controls. Section 13 here only says how to express those controls in code -- it never relaxes one. |
| `docs/TESTING/00-TEST-STRATEGY.md` | Which layer tests which behavior. Section 9 here covers file layout, naming, and helpers. |
| `TASKS/00-TASK-CONVENTIONS.md` | Branch, commit, and Definition-of-Done rules. Section 11 here does not restate them, it points at them. |
| `MEMORY/DECISIONS.md` | Why the choices here were made -- see `ADR-010` and `ADR-011`. |
