import { describe, expect, it } from "vitest";

import { configPackageName } from "./index";

describe("@image-delivery/config", () => {
  it("exposes its package name", () => {
    expect(configPackageName).toBe("@image-delivery/config");
  });
});
