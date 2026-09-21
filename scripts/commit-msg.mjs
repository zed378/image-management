// commit-msg hook (P0-11, TASKS/00-TASK-CONVENTIONS.md "Branching & commits").
// A commit subject is the join key between git history and the task plan:
//   P{phase}-{seq}: <imperative summary>     task work
//   fix: / chore: / docs: <summary>           outside a task (docs-only edits
//                                             may go straight to main)
//   wip: <summary>                            branch-local; squashed away
// plus git's own "Merge ..." and 'Revert "..."' subjects.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SUBJECT_PATTERN = /^(P\d+-\d{2}|fix|chore|docs|wip): \S.{0,99}$/u;
const GIT_GENERATED = /^(Merge |Revert ")/u;

export const checkSubject = (subject) =>
  GIT_GENERATED.test(subject) || SUBJECT_PATTERN.test(subject)
    ? null
    : `commit subject must look like "P2-07: add presigned upload endpoint" ` +
      `(or fix:/chore:/docs:/wip:), at most 100 characters after the prefix; got: "${subject}"`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("usage: commit-msg.mjs <commit-message-file>\n");
    process.exit(2);
  }
  const subject =
    readFileSync(file, "utf8")
      .split("\n")
      .find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";
  const problem = checkSubject(subject.trim());
  if (problem) {
    process.stderr.write(`${problem}\n`);
    process.exit(1);
  }
}
