import { monotonicFactory } from "ulid";

// ULIDs for every user-facing resource id (ADR-003): sortable, URL-safe,
// generated without coordination, and not enumerable.
//
// Crockford base32, 26 characters, uppercase. The first 10 characters encode
// the millisecond timestamp, which is what makes keyset pagination on the
// primary key work (docs/API/07-PAGINATION.md).

export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Same regex, as a string, for use in SQL CHECK constraints. */
export const ULID_SQL_PATTERN = "^[0-9A-HJKMNP-TV-Z]{26}$";

// Monotonic within a millisecond, so ids generated in a tight loop still sort
// in creation order.
const nextUlid = monotonicFactory();

export const newId = (): string => nextUlid();

export const isUlid = (value: unknown): value is string =>
  typeof value === "string" && ULID_PATTERN.test(value);
