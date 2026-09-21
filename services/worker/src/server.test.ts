import { describe, expect, it } from "vitest";

import { serviceName } from "./server";

describe("worker service", () => {
  it("identifies itself", () => {
    expect(serviceName).toBe("worker");
  });
});
