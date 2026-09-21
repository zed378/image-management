// Bounds and versioned tables for transformation parameters
// (docs/IMAGE-DELIVERY-PROTOCOL/04, docs/PLAN/15, ADR-014, ADR-023).
// Every number here is a contract: changing one changes the bytes behind
// unchanged URLs, so each table carries a version that enters params_hash.

export const TRANSFORM_MAX_DIMENSION_PX = 8192;
export const TRANSFORM_MAX_PIXELS = 25_000_000;
export const DPR_MIN = 0.5;
export const DPR_MAX = 3;
export const AR_PART_MAX = 1000;
export const EFFECT_MAX = 100;
export const DOWNLOAD_NAME_MAX = 255;

/** ADR-014: the opt-in dimension ladder (Next.js imageSizes + deviceSizes). */
export const DIMENSION_LADDER = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const;

export const OUTPUT_FORMATS = ["avif", "webp", "jpeg", "png"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** ADR-008: the three Accept buckets, in priority order. */
export const ACCEPT_BUCKETS = ["avif", "webp", "jpeg"] as const;
export type AcceptBucket = (typeof ACCEPT_BUCKETS)[number];

/**
 * q=auto, per output format. Provisional values until P3-01's benchmark
 * sets them (docs/IMAGE-PROCESSING/09); png is lossless and takes none.
 */
export const QUALITY_TABLE: Readonly<Record<Exclude<OutputFormat, "png">, number>> = {
  avif: 50,
  webp: 75,
  jpeg: 80,
};

/**
 * The versions of every table whose values change output for an unchanged
 * URL (ADR-014). Bump the matching entry whenever a table's values change;
 * the combined string is part of the params_hash input, so every derivative
 * made under the old values gets a new identity.
 */
export const TABLE_VERSIONS = {
  /** QUALITY_TABLE */
  quality: 1,
  /** DIMENSION_LADDER */
  ladder: 1,
  /** blur/sharpen 0..100 -> engine sigma (docs/IMAGE-PROCESSING/11) */
  effects: 1,
  /** f=auto resolution order (ADR-008) */
  formats: 1,
} as const;

export const TABLES_VERSION = `q${TABLE_VERSIONS.quality}.l${TABLE_VERSIONS.ladder}.e${TABLE_VERSIONS.effects}.f${TABLE_VERSIONS.formats}`;

/** Protocol version of the canonical form itself; part of the hash input. */
export const CANONICAL_FORM_VERSION = "idp1";

/** params_hash length in hex characters: 128 bits. */
export const PARAMS_HASH_HEX_LENGTH = 32;
