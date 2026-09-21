import { describe, expect, it } from "vitest";

import { queuePackageName } from "./index";

describe("@image-delivery/queue", () => {
  it("exposes its package name", () => {
    expect(queuePackageName).toBe("@image-delivery/queue");
  });
});
