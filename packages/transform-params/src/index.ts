// The one canonical transformation-parameter normalizer and params_hash (ADR-004).
export {
  bucketFromAccept,
  canonicalize,
  computeParamsHash,
  isNearMiss,
  type Canonical,
  type CanonicalizeContext,
  type Rect,
  type SourceFacts,
} from "./canonicalize";
export {
  ACCEPT_BUCKETS,
  DIMENSION_LADDER,
  OUTPUT_FORMATS,
  QUALITY_TABLE,
  TABLE_VERSIONS,
  TABLES_VERSION,
  TRANSFORM_MAX_DIMENSION_PX,
  TRANSFORM_MAX_PIXELS,
  type AcceptBucket,
  type OutputFormat,
} from "./constants";
