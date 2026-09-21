import { describe, expect, it } from "vitest";

import { loggerPackageName } from "./index";

describe("@image-delivery/logger", () => {
  it("exposes its package name", () => {
    expect(loggerPackageName).toBe("@image-delivery/logger");
  });
});
