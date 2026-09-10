# {TASK-ID}: {Task title, copied from TASKS/}

- **Date:** {date completed}
- **Author:** {human name or "Agent session (model/tool)"}
- **Branch / PR:** {branch name, PR link or number}
- **Implements:** {doc paths, copied from the task}

## What was built

Plain description of what actually exists now that didn't before. Link to
the key files/modules, not just a restatement of the task's steps.

## Deviations from the spec

Anything that differs from what `docs/` or the task description said,
and why. If there was no deviation, say so explicitly ("implemented exactly
as specified") rather than leaving this section silently empty --
future readers should not have to guess whether it was skipped or truly
had nothing to report.

## Decisions worth recording

Link to a `MEMORY/DECISIONS.md` ADR if this task produced one. If a real
fork in the road came up but didn't rise to ADR-worthy, note the reasoning
briefly here instead.

## Tests added

List the test files/suites added or extended, and specifically call out
any IDOR/BOLA or other security-critical test required by
`TASKS/00-TASK-CONVENTIONS.md`.

## What the next task/session needs to know

Anything non-obvious that would save the next person time: a gotcha in the
local dev setup, a TODO deliberately left for a later task, a config value
that must be set before this works outside `local`.
