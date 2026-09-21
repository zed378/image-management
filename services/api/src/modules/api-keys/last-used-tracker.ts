import { LAST_USED_FLUSH_INTERVAL_MS } from "./api-key.constants";

// last_used_at without a write on the request path (P1-02 step 4): an
// authenticated request only adds its key id to an in-memory set; a timer
// writes the whole set in one statement. Losing up to one interval of
// "last used" on a crash is acceptable for a hygiene signal; adding a write
// to every request is not.

export type LastUsedTracker = {
  /** Note that a key was used now. O(1), no I/O. */
  readonly seen: (keyId: string) => void;
  /** Write every noted key; resolves when the write is done. */
  readonly flush: () => Promise<void>;
  /** Start periodic flushing. */
  readonly start: () => void;
  /** Stop the timer and flush what is pending (graceful shutdown). */
  readonly stop: () => Promise<void>;
};

export const createLastUsedTracker = (
  write: (keyIds: readonly string[], at: Date) => Promise<void>,
  options: {
    readonly intervalMs?: number;
    readonly now?: () => Date;
    readonly onError?: (err: unknown) => void;
  } = {},
): LastUsedTracker => {
  const now = options.now ?? (() => new Date());
  let pending = new Set<string>();
  let timer: NodeJS.Timeout | null = null;

  const flush = async (): Promise<void> => {
    if (pending.size === 0) return;
    const batch = [...pending];
    pending = new Set();
    try {
      await write(batch, now());
    } catch (err) {
      // Best effort: put the ids back for the next flush, report, carry on.
      for (const id of batch) pending.add(id);
      options.onError?.(err);
    }
  };

  return {
    seen: (keyId) => {
      pending.add(keyId);
    },
    flush,
    start: () => {
      if (timer) return;
      timer = setInterval(() => void flush(), options.intervalMs ?? LAST_USED_FLUSH_INTERVAL_MS);
      timer.unref();
    },
    stop: async () => {
      if (timer) clearInterval(timer);
      timer = null;
      await flush();
    },
  };
};
