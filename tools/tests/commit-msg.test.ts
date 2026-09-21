import { describe, expect, it } from "vitest";

// @ts-expect-error -- plain .mjs hook script, no declaration file
import { checkSubject } from "../../scripts/commit-msg.mjs";

const check = checkSubject as (subject: string) => string | null;

describe("the commit-msg hook", () => {
  it.each([
    "P0-11: enforce the engineering conventions in tooling",
    "P12-03: add a thing",
    "fix: correct pino imports so the logger package typechecks",
    "chore: record P0-03 merge style in progress board",
    "docs: clarify the cache key",
    "wip: feat/P0-11-tooling-enforcement",
    "Merge branch 'main' into feat/P1-01-schema",
    'Revert "P0-09: add the error-code registry"',
  ])("accepts %s", (subject) => {
    expect(check(subject)).toBeNull();
  });

  it.each([
    "add stuff",
    "P0-1: single-digit sequence",
    "p0-11: lowercase prefix",
    "P0-11 missing colon",
    "P0-11:  ",
    "feat: conventional-commit type not used here",
    `P0-11: ${"x".repeat(101)}`,
  ])("rejects %s", (subject) => {
    expect(check(subject)).toMatch(/commit subject must look like/);
  });
});
