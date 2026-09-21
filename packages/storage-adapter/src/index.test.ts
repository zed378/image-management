import { describe, expect, it } from "vitest";

import { storageAdapterPackageName } from "./index";

describe("@image-delivery/storage-adapter", () => {
  it("exposes its package name", () => {
    expect(storageAdapterPackageName).toBe("@image-delivery/storage-adapter");
  });
});
