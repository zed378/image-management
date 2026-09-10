# MEMORY -- The Record

`docs/` says what the platform should be. `TASKS/` says what to build and in
what order. `MEMORY/` says what actually happened: which decisions were
made and why, what was built, what deviated from the spec, and what a
future contributor (human or AI agent) needs to know before touching the
same area again.

This directory exists because a specification and a task list both go
stale the moment reality disagrees with them, and without a record of *why*
a decision was made, the next person (or the next agent session, which has
no memory of this one) either repeats a rejected approach or "fixes" a
deliberate tradeoff back into a bug.

## Structure

```
MEMORY/
  README.md          <- this file
  DECISIONS.md        <- the ADR log: every non-obvious decision, what was
                          rejected, and why
  records/
    TEMPLATE.md       <- copy this for every completed task
    P0-01.md          <- one record per task, named by task ID
    P0-02.md
    ...
```

## When to write to MEMORY/

- **`DECISIONS.md`**: whenever a task forecloses a real alternative (chose
  `sharp` over a dedicated processing microservice; chose content-addressed
  cache keys over provider purge APIs; chose ULIDs over UUIDv4). Not every
  choice needs an ADR -- only the ones where someone could reasonably ask
  "why not the other way?" and deserves a real answer, not a guess.
- **`records/{TASK-ID}.md`**: every single time a task from `TASKS/` is
  completed, no exceptions. This is what `TASKS/00-TASK-CONVENTIONS.md`'s
  Definition of Done requires. A task without a record is, for the purposes
  of the next session, a task that didn't happen -- the reasoning and any
  deviation from plan are invisible without it.

## Rules

1. **Additive, not rewritten.** Past decisions and records are not edited
   to look retroactively correct. If a later task reverses an earlier
   decision, add a new ADR that supersedes the old one (`ADR-014
   supersedes ADR-004`) -- the old one stays, marked superseded, so the
   history of *why things changed* is preserved.
2. **Specific, not vibes.** "Chose Postgres for reliability" is not a
   decision record. "Chose Postgres over DynamoDB because the data model
   is relational (tenants -> applications -> projects -> assets) with
   query patterns that need joins and range scans DynamoDB makes awkward;
   revisit if a single table exceeds ~50M rows and write amplification
   becomes the bottleneck" is one.
3. **Read before you plan.** Before starting a task, read
   `MEMORY/DECISIONS.md` in full (it should stay small enough to read in
   one sitting -- if it isn't, that's a sign some entries should be pruned
   or consolidated) and the records for any task this one depends on.
