import { describe, expect, it } from "vitest";

import { cachePackageName } from "./index";

describe("@image-delivery/cache", () => {
  it("exposes its package name", () => {
    expect(cachePackageName).toBe("@image-delivery/cache");
  });
});
