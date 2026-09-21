// Blunts credential stuffing against the API (P1-03 step 3,
// docs/SECURITY/15): after too many failed authentications from one address
// in a window, further attempts from it are refused with 429 before any key
// is looked up. In-memory and per process -- a floor, not the full rate
// limiter (P5-03 moves it to Redis, shared across processes).
//
// Only failures count: a client with a valid key is never slowed by this.

export type FailureLimiter = {
  /** Seconds until `address` may try again; 0 when it is not blocked. */
  readonly blockedForSeconds: (address: string) => number;
  readonly recordFailure: (address: string) => void;
};

export type FailureLimiterOptions = {
  /** Failures allowed per window before blocking. */
  readonly maxFailures?: number;
  readonly windowMs?: number;
  /** Addresses tracked at most; the oldest are forgotten first. */
  readonly maxTracked?: number;
  readonly now?: () => number;
};

export const DEFAULT_MAX_AUTH_FAILURES = 20;
export const DEFAULT_AUTH_FAILURE_WINDOW_MS = 60_000;
const DEFAULT_MAX_TRACKED = 10_000;

type Entry = { count: number; windowStart: number };

export const createFailureLimiter = (options: FailureLimiterOptions = {}): FailureLimiter => {
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_AUTH_FAILURES;
  const windowMs = options.windowMs ?? DEFAULT_AUTH_FAILURE_WINDOW_MS;
  const maxTracked = options.maxTracked ?? DEFAULT_MAX_TRACKED;
  const now = options.now ?? Date.now;
  // Map preserves insertion order: the first key is the oldest entry.
  const entries = new Map<string, Entry>();

  const current = (address: string): Entry | undefined => {
    const entry = entries.get(address);
    if (entry && now() - entry.windowStart >= windowMs) {
      entries.delete(address);
      return undefined;
    }
    return entry;
  };

  return {
    blockedForSeconds: (address) => {
      const entry = current(address);
      if (!entry || entry.count < maxFailures) return 0;
      return Math.max(1, Math.ceil((entry.windowStart + windowMs - now()) / 1000));
    },
    recordFailure: (address) => {
      const entry = current(address);
      if (entry) {
        entry.count += 1;
        return;
      }
      if (entries.size >= maxTracked) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
      entries.set(address, { count: 1, windowStart: now() });
    },
  };
};
