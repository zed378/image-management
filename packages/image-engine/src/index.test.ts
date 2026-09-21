import { describe, expect, it } from "vitest";

import { imageEnginePackageName } from "./index";

describe("@image-delivery/image-engine", () => {
  it("exposes its package name", () => {
    expect(imageEnginePackageName).toBe("@image-delivery/image-engine");
  });
});
