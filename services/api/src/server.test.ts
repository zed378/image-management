import { describe, expect, it } from "vitest";

import { serviceName } from "./server";

describe("api service", () => {
  it("identifies itself", () => {
    expect(serviceName).toBe("api");
  });
});
