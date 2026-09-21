import { describe, expect, it } from "vitest";

import { tenancyPackageName } from "./index";

describe("@image-delivery/tenancy", () => {
  it("exposes its package name", () => {
    expect(tenancyPackageName).toBe("@image-delivery/tenancy");
  });
});
