// docs/SECURITY/04-API-KEY-MANAGEMENT.md, ADR-022 point 4.

/** Every key starts with this, then the environment: `ak_live_...`, `ak_test_...`. */
export const API_KEY_PREFIX = "ak";

/** 256 bits: brute force is not a threat model, so a fast keyed hash suffices. */
export const API_KEY_SECRET_BYTES = 32;

/** base64url length of API_KEY_SECRET_BYTES, unpadded. */
export const API_KEY_SECRET_LENGTH = 43;

export const API_KEY_ENVIRONMENTS = ["live", "test"] as const;

/** How long a rotated key keeps working when the caller does not say. */
export const DEFAULT_ROTATION_OVERLAP_SECONDS = 24 * 60 * 60;

/** The longest overlap a rotation may request. */
export const MAX_ROTATION_OVERLAP_SECONDS = 7 * 24 * 60 * 60;

export const MAX_API_KEY_NAME_LENGTH = 200;
export const MAX_PERMISSIONS_PER_KEY = 64;
export const MAX_PROJECTS_PER_KEY = 100;

/** last_used_at is written at most this often per key (P1-02 step 4). */
export const LAST_USED_FLUSH_INTERVAL_MS = 60_000;
