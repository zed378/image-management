import { describe, expect, it } from "vitest";

import { createApiKeyBodySchema, rotateApiKeyBodySchema } from "./api-key.schema";

const P1 = "01HZZZZZZZZZZZZZZZZZZZZZP1";
const P2 = "01HZZZZZZZZZZZZZZZZZZZZZP2";

const base = { name: " ci ", environment: "live", permissions: ["asset:read"] };

describe("createApiKeyBodySchema", () => {
  it("accepts all_projects, trimming the name and sorting permissions", () => {
    const parsed = createApiKeyBodySchema.parse({
      ...base,
      permissions: ["asset:read", "asset:create", "asset:read"],
      all_projects: true,
    });

    expect(parsed).toEqual({
      name: "ci",
      environment: "live",
      permissions: ["asset:create", "asset:read"],
      all_projects: true,
      project_ids: [],
    });
  });

  it("accepts a project list, deduplicated", () => {
    const parsed = createApiKeyBodySchema.parse({ ...base, project_ids: [P2, P1, P2] });

    expect(parsed.project_ids).toEqual([P1, P2]);
    expect(parsed.all_projects).toBe(false);
  });

  it.each([
    ["neither coverage", {}],
    ["both coverages", { all_projects: true, project_ids: [P1] }],
    ["a malformed project id", { project_ids: ["nope"] }],
    ["an unknown field", { all_projects: true, tenant_id: P1 }],
    ["a malformed permission", { all_projects: true, permissions: ["Asset Read"] }],
    ["no permissions", { all_projects: true, permissions: [] }],
    ["an unknown environment", { all_projects: true, environment: "prod" }],
  ])("rejects %s", (_name, overrides) => {
    expect(createApiKeyBodySchema.safeParse({ ...base, ...overrides }).success).toBe(false);
  });
});

describe("rotateApiKeyBodySchema", () => {
  it("bounds the overlap to seven days", () => {
    expect(rotateApiKeyBodySchema.safeParse({ overlap_seconds: 604_800 }).success).toBe(true);
    expect(rotateApiKeyBodySchema.safeParse({ overlap_seconds: 604_801 }).success).toBe(false);
    expect(rotateApiKeyBodySchema.parse({})).toEqual({});
  });
});
