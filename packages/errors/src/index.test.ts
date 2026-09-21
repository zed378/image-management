import { describe, expect, it } from "vitest";

import { errorsPackageName } from "./index";

describe("@image-delivery/errors", () => {
  it("exposes its package name", () => {
    expect(errorsPackageName).toBe("@image-delivery/errors");
  });
});
