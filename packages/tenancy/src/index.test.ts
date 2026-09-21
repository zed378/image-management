import { describe, expect, it } from "vitest";

import { inProject, systemContext } from "./index";

describe("TenantContext helpers", () => {
  it("builds a system context with no permissions", () => {
    const ctx = systemContext("T", "R");

    expect(ctx).toMatchObject({
      tenantId: "T",
      applicationId: null,
      projectId: null,
      actor: { type: "system", id: null },
      projectAccess: "all",
      requestId: "R",
    });
    expect(ctx.permissions.size).toBe(0);
  });

  it("narrows a context to one project without changing anything else", () => {
    const ctx = systemContext("T");

    expect(inProject(ctx, "P")).toEqual({ ...ctx, projectId: "P" });
  });
});
