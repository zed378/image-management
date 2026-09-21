import { afterEach, describe, expect, it, vi } from "vitest";

import { createLastUsedTracker } from "./last-used-tracker";

const AT = new Date("2026-09-21T12:00:00Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("last-used tracker", () => {
  it("writes every key seen since the last flush in one call, deduplicated", async () => {
    const write = vi.fn(() => Promise.resolve());
    const tracker = createLastUsedTracker(write, { now: () => AT });
    tracker.seen("a");
    tracker.seen("b");
    tracker.seen("a");

    await tracker.flush();

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(["a", "b"], AT);
  });

  it("does not write when nothing was seen", async () => {
    const write = vi.fn(() => Promise.resolve());

    await createLastUsedTracker(write).flush();

    expect(write).not.toHaveBeenCalled();
  });

  it("keeps the batch for the next flush when a write fails, and reports it", async () => {
    const write = vi
      .fn<(ids: readonly string[], at: Date) => Promise<void>>()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const tracker = createLastUsedTracker(write, { onError, now: () => AT });
    tracker.seen("a");

    await tracker.flush();
    await tracker.flush();

    expect(onError).toHaveBeenCalledOnce();
    expect(write).toHaveBeenLastCalledWith(["a"], AT);
  });

  it("flushes on its interval and once more on stop", async () => {
    vi.useFakeTimers();
    const write = vi.fn(() => Promise.resolve());
    const tracker = createLastUsedTracker(write, { intervalMs: 1_000, now: () => AT });
    tracker.start();
    tracker.start();

    tracker.seen("a");
    await vi.advanceTimersByTimeAsync(1_000);
    tracker.seen("b");
    await tracker.stop();

    expect(write.mock.calls).toEqual([
      [["a"], AT],
      [["b"], AT],
    ]);
  });
});
