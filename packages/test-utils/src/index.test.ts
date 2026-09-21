import { describe, expect, it } from "vitest";

import { testUtilsPackageName } from "./index";

describe("@image-delivery/test-utils", () => {
  it("exposes its package name", () => {
    expect(testUtilsPackageName).toBe("@image-delivery/test-utils");
  });
});
