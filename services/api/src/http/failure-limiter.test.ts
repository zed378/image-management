import { describe, expect, it } from "vitest";

import { createFailureLimiter } from "./failure-limiter";

describe("failure limiter", () => {
  it("blocks after the budget, until the window ends", () => {
    let now = 0;
    const limiter = createFailureLimiter({ maxFailures: 2, windowMs: 10_000, now: () => now });

    limiter.recordFailure("a");
    expect(limiter.blockedForSeconds("a")).toBe(0);
    limiter.recordFailure("a");
    expect(limiter.blockedForSeconds("a")).toBe(10);

    now = 9_500;
    expect(limiter.blockedForSeconds("a")).toBe(1);
    now = 10_000;
    expect(limiter.blockedForSeconds("a")).toBe(0);
  });

  it("starts a fresh window after the old one expires", () => {
    let now = 0;
    const limiter = createFailureLimiter({ maxFailures: 2, windowMs: 1_000, now: () => now });
    limiter.recordFailure("a");

    now = 1_000;
    limiter.recordFailure("a");

    expect(limiter.blockedForSeconds("a")).toBe(0);
  });

  it("forgets the oldest address when it tracks too many", () => {
    const limiter = createFailureLimiter({ maxFailures: 1, maxTracked: 2, now: () => 0 });
    limiter.recordFailure("a");
    limiter.recordFailure("b");
    limiter.recordFailure("c");

    expect(limiter.blockedForSeconds("a")).toBe(0);
    expect(limiter.blockedForSeconds("b")).toBeGreaterThan(0);
    expect(limiter.blockedForSeconds("c")).toBeGreaterThan(0);
  });
});
