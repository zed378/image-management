import { describe, expect, it } from "vitest";

import { dbPackageName } from "./index";

describe("@image-delivery/db", () => {
  it("exposes its package name", () => {
    expect(dbPackageName).toBe("@image-delivery/db");
  });
});
