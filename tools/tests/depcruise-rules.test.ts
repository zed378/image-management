import { createRequire } from "node:module";
import path from "node:path";

import { cruise, type ICruiseResult, type IConfiguration } from "dependency-cruiser";
import { beforeAll, describe, expect, it } from "vitest";

// P0-11 DoD: every dependency-cruiser rule is proven to fire, not just
// present. Each fixture under fixtures/depcruise/ breaks exactly one rule;
// the fixture tree mirrors the repository layout, so the real config's
// path-based rules apply to it unchanged.

const ROOT = path.resolve(import.meta.dirname, "../..");
const FIXTURES = path.join(import.meta.dirname, "fixtures", "depcruise");
const config = createRequire(import.meta.url)(
  path.join(ROOT, ".dependency-cruiser.cjs"),
) as IConfiguration;

let result: ICruiseResult;

beforeAll(async () => {
  const { forbidden, options } = config;
  const reporter = await cruise(
    ["services", "packages", "apps"],
    { ...options, baseDir: FIXTURES, validate: true, ruleSet: { forbidden } },
    { extensions: [".ts"] },
  );
  result = reporter.output as ICruiseResult;
});

const violationsOf = (rule: string) =>
  result.summary.violations.filter((v) => v.rule.name === rule).map((v) => `${v.from} -> ${v.to}`);

describe("dependency-cruiser rules fire on their fixtures", () => {
  it.each([
    ["no-service-to-service", "services/a/src/index.ts -> services/b/src/thing.ts"],
    ["no-package-to-service", "packages/p/src/index.ts -> services/b/src/thing.ts"],
    ["no-deep-package-import", "services/a/src/deep.ts -> packages/p/src/private.ts"],
    ["no-app-to-internals", "apps/web/src/page.ts -> packages/db/src/index.ts"],
    ["not-to-unresolvable", "services/a/src/missing.ts -> ./nope"],
  ])("%s", (rule, edge) => {
    expect(violationsOf(rule)).toContain(edge);
  });

  it("no-circular", () => {
    expect(violationsOf("no-circular").some((v) => v.includes("packages/q/src/"))).toBe(true);
  });

  it("reports nothing beyond the planted violations", () => {
    const rules = new Set(result.summary.violations.map((v) => v.rule.name));

    expect([...rules].sort()).toEqual(
      [
        "no-app-to-internals",
        "no-circular",
        "no-deep-package-import",
        "no-package-to-service",
        "no-service-to-service",
        "not-to-unresolvable",
      ].sort(),
    );
  });
});
