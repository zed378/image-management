import { describe, expect, it } from "vitest";

import { signingPackageName } from "./index";

describe("@image-delivery/signing", () => {
  it("exposes its package name", () => {
    expect(signingPackageName).toBe("@image-delivery/signing");
  });
});
