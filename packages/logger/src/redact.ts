// What never reaches a log line, at any level (docs/ENGINEERING/12,
// docs/DEVOPS/04-SECRETS-MANAGEMENT.md). Enforced by a test that serializes
// a sentinel secret in each of these shapes through the real logger.

/** pino redaction paths. `*` matches one level of nesting. */
export const REDACT_PATHS: readonly string[] = [
  // HTTP credentials
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  // Credential-shaped fields, at the top level and one level down
  "api_key",
  "apiKey",
  "secret",
  "password",
  "signature",
  "token",
  "access_token",
  "refresh_token",
  "signing_secret",
  "signingSecret",
  "secret_access_key",
  "secretAccessKey",
  "presigned_url",
  "presignedUrl",
  "signed_url",
  "signedUrl",
  "*.api_key",
  "*.apiKey",
  "*.secret",
  "*.password",
  "*.signature",
  "*.token",
  "*.access_token",
  "*.refresh_token",
  "*.signing_secret",
  "*.signingSecret",
  "*.secret_access_key",
  "*.secretAccessKey",
  "*.presigned_url",
  "*.presignedUrl",
  "*.signed_url",
  "*.signedUrl",
  // Errors thrown by HTTP clients carry their request configuration
  "err.config.headers.authorization",
];

export const REDACTED = "[redacted]";

/**
 * Query-string parameters that carry an access grant. A URL logged with any
 * of these intact is the grant, re-issued to everyone with log access.
 */
const SENSITIVE_QUERY_PARAMS = new Set(
  [
    "sig",
    "s",
    "signature",
    "token",
    "api_key",
    "apikey",
    "x-amz-signature",
    "x-amz-credential",
    "x-amz-security-token",
  ].map((p) => p.toLowerCase()),
);

/**
 * Remove access-granting query parameters from a URL or path before it is
 * logged. Keeps everything else -- the path and the transformation
 * parameters are exactly what an operator needs to debug a request.
 *
 * Works on absolute URLs and on bare paths (`/i/abc?w=1&sig=...`).
 */
export const redactUrl = (raw: string): string => {
  const queryStart = raw.indexOf("?");
  if (queryStart === -1) return raw;
  const base = raw.slice(0, queryStart);
  const hashStart = raw.indexOf("#", queryStart);
  const query = raw.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart);

  const kept = query
    .split("&")
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const key = decodeURIComponentSafe(pair.split("=", 1)[0] ?? "").toLowerCase();
      return SENSITIVE_QUERY_PARAMS.has(key) ? `${pair.split("=", 1)[0]}=${REDACTED}` : pair;
    });

  return kept.length > 0 ? `${base}?${kept.join("&")}` : base;
};

const decodeURIComponentSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
