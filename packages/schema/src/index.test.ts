import { describe, expect, it } from "vitest";

import { schemaPackageName } from "./index";

describe("@image-delivery/schema", () => {
  it("exposes its package name", () => {
    expect(schemaPackageName).toBe("@image-delivery/schema");
  });
});
