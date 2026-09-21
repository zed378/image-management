import { describe, expect, it } from "vitest";

import { transformParamsPackageName } from "./index";

describe("@image-delivery/transform-params", () => {
  it("exposes its package name", () => {
    expect(transformParamsPackageName).toBe("@image-delivery/transform-params");
  });
});
