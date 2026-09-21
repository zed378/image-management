import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@image-delivery/errors";
import { createLogger } from "@image-delivery/logger";

import { buildApp } from "../src/app";
import { stubApiKeys } from "./support/stub-api-keys";

import type { FastifyInstance } from "fastify";

// docs/API/05-ERROR-HANDLING.md: every failure mode reaches the client as the
// error envelope with a registered code, and nothing internal leaks.

const SECRET = "postgres://image_delivery:S3CR3T-PW@10.0.3.7:5432/db";

let app: FastifyInstance;
let logs: () => Record<string, unknown>[];

beforeAll(async () => {
  const chunks: string[] = [];
  app = await buildApp({
    logger: createLogger({
      service: "api",
      version: "test",
      level: "info",
      destination: { write: (c: string) => void chunks.push(c) },
    }),
    readinessChecks: {},
    apiKeys: stubApiKeys(),
  });
  logs = () =>
    chunks
      .join("")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  app.get("/t/app-error-404", async () => {
    throw new AppError("asset_not_found");
  });
  app.get("/t/app-error-400", async () => {
    throw new AppError("invalid_transform_param", {
      message: "Parameter 'w' must be between 1 and 8192.",
      details: [{ field: "w", reason: "out_of_range" }],
    });
  });
  app.get("/t/app-error-503", async () => {
    throw new AppError("storage_unavailable", { message: `cannot reach ${SECRET}` });
  });
  app.get("/t/unknown", async () => {
    throw new Error(`connection failed: ${SECRET}`);
  });
  app.get("/t/zod", async (request) => {
    z.object({ w: z.coerce.number().int().max(8192) })
      .strict()
      .parse(request.query);
    return {};
  });
  app.post(
    "/t/schema",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: { name: { type: "string" } },
        },
      },
    },
    async () => ({}),
  );
});

const errorOf = (res: { json: () => unknown }) =>
  (res.json() as { error: Record<string, unknown> }).error;

describe("error envelope mapping", () => {
  it("maps an AppError to its registry status and code", async () => {
    const res = await app.inject({ method: "GET", url: "/t/app-error-404" });

    expect(res.statusCode).toBe(404);
    expect(errorOf(res)).toEqual({
      code: "asset_not_found",
      message: "No asset with that id exists.",
      details: [],
      request_id: res.headers["x-request-id"],
    });
  });

  it("carries a 4xx AppError's specific message and details", async () => {
    const res = await app.inject({ method: "GET", url: "/t/app-error-400" });

    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatchObject({
      code: "invalid_transform_param",
      message: "Parameter 'w' must be between 1 and 8192.",
      details: [{ field: "w", reason: "out_of_range" }],
    });
  });

  it("replaces a 5xx AppError's message with the generic one and adds Retry-After", async () => {
    const res = await app.inject({ method: "GET", url: "/t/app-error-503" });

    expect(res.statusCode).toBe(503);
    expect(errorOf(res)).toMatchObject({
      code: "storage_unavailable",
      message: "Storage is temporarily unavailable.",
    });
    expect(res.headers["retry-after"]).toBe("5");
    expect(res.body).not.toContain("S3CR3T");
  });

  it("turns an unknown error into a generic 500 and logs the real cause", async () => {
    const res = await app.inject({ method: "GET", url: "/t/unknown" });

    expect(res.statusCode).toBe(500);
    expect(errorOf(res)).toEqual({
      code: "internal_error",
      message: "An unexpected error occurred.",
      details: [],
      request_id: res.headers["x-request-id"],
    });
    expect(res.body).not.toContain("S3CR3T");
    expect(res.body).not.toContain("10.0.3.7");
    const failure = logs().find(
      (l) => l["msg"] === "request failed" && l["request_id"] === res.headers["x-request-id"],
    );
    expect(failure?.["level"]).toBe("error");
    expect(JSON.stringify(failure?.["err"])).toContain("connection failed");
  });

  it("maps a Zod validation failure to 400 with field and reason only", async () => {
    const res = await app.inject({ method: "GET", url: "/t/zod?w=99999&evil=%3Cscript%3E" });

    expect(res.statusCode).toBe(400);
    const error = errorOf(res);
    expect(error["code"]).toBe("validation_failed");
    expect(error["details"]).toEqual(expect.arrayContaining([{ field: "w", reason: "too_big" }]));
    expect(res.body).not.toContain("99999");
    expect(res.body).not.toContain("script");
  });

  it("maps a route schema failure to 400 validation_failed", async () => {
    const res = await app.inject({ method: "POST", url: "/t/schema", payload: { nope: 1 } });

    expect(res.statusCode).toBe(400);
    expect(errorOf(res)["code"]).toBe("validation_failed");
    expect(errorOf(res)["details"]).toEqual(
      expect.arrayContaining([{ field: "name", reason: "required" }]),
    );
  });

  it("maps malformed JSON to 400 malformed_json", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/t/schema",
      headers: { "content-type": "application/json" },
      payload: '{"name": "unterminated',
    });

    expect(res.statusCode).toBe(400);
    expect(errorOf(res)["code"]).toBe("malformed_json");
  });

  it("maps an oversized body to 413 payload_too_large", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/t/schema",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "x".repeat(1024 * 1024 + 10) }),
    });

    expect(res.statusCode).toBe(413);
    expect(errorOf(res)["code"]).toBe("payload_too_large");
  });

  it("maps an unsupported content type to 415 unsupported_media_type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/t/schema",
      headers: { "content-type": "application/x-made-up" },
      payload: "x",
    });

    expect(res.statusCode).toBe(415);
    expect(errorOf(res)["code"]).toBe("unsupported_media_type");
  });

  it("logs a 4xx at warn and a 5xx at error", async () => {
    const r400 = await app.inject({ method: "GET", url: "/t/app-error-400" });
    const r500 = await app.inject({ method: "GET", url: "/t/unknown" });

    const lineFor = (id: unknown, msg: string) =>
      logs().find((l) => l["request_id"] === id && l["msg"] === msg);
    expect(lineFor(r400.headers["x-request-id"], "request rejected")?.["level"]).toBe("warn");
    expect(lineFor(r500.headers["x-request-id"], "request failed")?.["level"]).toBe("error");
  });
});
