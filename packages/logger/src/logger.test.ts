import { describe, expect, it } from "vitest";

import { createLogger, requestLogger, withTenant, type Logger } from "./logger";
import { REDACTED } from "./redact";

const SENTINEL = "SENTINEL-SECRET-8f3a91c2";

const capture = (): {
  logger: Logger;
  lines: () => Record<string, unknown>[];
  raw: () => string;
} => {
  const chunks: string[] = [];
  const logger = createLogger({
    service: "api",
    version: "1.2.3",
    level: "trace",
    destination: { write: (chunk: string) => void chunks.push(chunk) },
  });
  return {
    logger,
    raw: () => chunks.join(""),
    lines: () =>
      chunks
        .join("")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as Record<string, unknown>),
  };
};

describe("createLogger", () => {
  it("writes one JSON object per line with service, version, level label and ISO time", () => {
    const { logger, lines } = capture();

    logger.info({ asset_id: "a1" }, "asset created");

    const [line] = lines();
    expect(line).toMatchObject({
      level: "info",
      service: "api",
      version: "1.2.3",
      asset_id: "a1",
      msg: "asset created",
    });
    expect(String(line?.["time"])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("serializes errors with their name, message and stack", () => {
    const { logger, lines } = capture();

    logger.error({ err: new TypeError("boom") }, "request failed");

    const err = lines()[0]?.["err"] as Record<string, unknown>;
    expect(err["type"]).toBe("TypeError");
    expect(err["message"]).toBe("boom");
    expect(String(err["stack"])).toContain("TypeError: boom");
  });

  it("binds request identifiers on every line of a request logger", () => {
    const { logger, lines } = capture();
    const req = requestLogger(logger, { request_id: "r1", trace_id: "t1", span_id: "s1" });

    req.info("one");
    req.warn("two");

    for (const line of lines()) {
      expect(line).toMatchObject({ request_id: "r1", trace_id: "t1", span_id: "s1" });
    }
  });

  it("binds the tenancy chain once known", () => {
    const { logger, lines } = capture();

    withTenant(logger, { tenant_id: "t_1", project_id: "p_1" }).info("scoped");

    expect(lines()[0]).toMatchObject({ tenant_id: "t_1", project_id: "p_1" });
  });
});

describe("redaction", () => {
  // Each case puts the sentinel where a real secret would plausibly be.
  const cases: [string, Record<string, unknown>][] = [
    ["authorization header", { req: { headers: { authorization: `Bearer ${SENTINEL}` } } }],
    ["cookie header", { req: { headers: { cookie: `session=${SENTINEL}` } } }],
    ["x-api-key header", { req: { headers: { "x-api-key": SENTINEL } } }],
    ["top-level api_key", { api_key: SENTINEL }],
    ["top-level apiKey", { apiKey: SENTINEL }],
    ["nested password", { user: { password: SENTINEL } }],
    ["nested secret", { application: { secret: SENTINEL } }],
    ["nested signature", { delivery: { signature: SENTINEL } }],
    ["nested token", { webhook: { token: SENTINEL } }],
    ["nested signing_secret", { app: { signing_secret: SENTINEL } }],
    ["nested secretAccessKey", { storage: { secretAccessKey: SENTINEL } }],
    ["presigned url", { upload: { presigned_url: `https://s3/x?X-Amz-Signature=${SENTINEL}` } }],
    ["signed url", { signed_url: `https://cdn/i/a?sig=${SENTINEL}` }],
    ["http client error config", { err: { config: { headers: { authorization: SENTINEL } } } }],
  ];

  it.each(cases)("removes a secret in the %s shape", (_shape, payload) => {
    const { logger, raw } = capture();

    logger.info(payload, "event");

    expect(raw()).not.toContain(SENTINEL);
    expect(raw()).toContain(REDACTED);
  });

  it("does not redact ordinary fields", () => {
    const { logger, lines } = capture();

    logger.info({ asset_id: "a1", params_hash: "abc", object_key: "t/p/originals/a1" }, "event");

    expect(lines()[0]).toMatchObject({
      asset_id: "a1",
      params_hash: "abc",
      object_key: "t/p/originals/a1",
    });
  });

  it("documents its limit: a secret two levels deep is NOT redacted", () => {
    // Redaction is a safety net, not a licence to log credential-bearing
    // objects. This test pins the boundary so nobody assumes more coverage
    // than exists (docs/OBSERVABILITY/01-LOGGING.md).
    const { logger, raw } = capture();

    logger.info({ a: { b: { password: SENTINEL } } }, "event");

    expect(raw()).toContain(SENTINEL);
  });
});
