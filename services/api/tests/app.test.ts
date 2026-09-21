import { describe, expect, it } from "vitest";

import { createLogger } from "@image-delivery/logger";

import { buildApp } from "../src/app";

import type { ReadinessCheck } from "../src/modules/health/health.routes";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const INCOMING = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

const setup = async (
  checks: Record<string, ReadinessCheck> = { database: async () => undefined },
) => {
  const chunks: string[] = [];
  const logger = createLogger({
    service: "api",
    version: "test",
    level: "info",
    destination: { write: (c: string) => void chunks.push(c) },
  });
  const app = await buildApp({ logger, readinessChecks: checks });
  const logs = (): Record<string, unknown>[] =>
    chunks
      .join("")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { app, logs };
};

describe("GET /healthz", () => {
  it("returns 200 in the success envelope with the request id in meta", async () => {
    const { app } = await setup();

    const res = await app.inject({ method: "GET", url: "/healthz" });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown; meta: { request_id: string } }>();
    expect(body.data).toEqual({ status: "ok" });
    expect(body.meta.request_id).toMatch(ULID);
    expect(res.headers["x-request-id"]).toBe(body.meta.request_id);
  });

  it("does not check dependencies, so an outage does not restart healthy replicas", async () => {
    const { app } = await setup({ database: () => Promise.reject(new Error("down")) });

    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
  });
});

describe("GET /readyz", () => {
  it("returns 200 with every check ok", async () => {
    const { app } = await setup({ database: async () => undefined, redis: async () => undefined });

    const res = await app.inject({ method: "GET", url: "/readyz" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      data: { status: "ready", checks: { database: "ok", redis: "ok" } },
    });
  });

  it("returns 503 in the error envelope naming the failing check, without its error message", async () => {
    const { app } = await setup({
      database: () =>
        Promise.reject(new Error("password authentication failed for user image_delivery")),
      redis: async () => undefined,
    });

    const res = await app.inject({ method: "GET", url: "/readyz" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      error: { code: "service_unavailable", details: [{ field: "database", reason: "failing" }] },
    });
    expect(res.body).not.toContain("password");
    expect(res.body).not.toContain("image_delivery");
  });

  it("fails a check that hangs instead of hanging the probe", async () => {
    const { app } = await setup({ storage: () => new Promise(() => undefined) });

    const started = Date.now();
    const res = await app.inject({ method: "GET", url: "/readyz" });

    expect(res.statusCode).toBe(503);
    expect(Date.now() - started).toBeLessThan(4_000);
  });
});

describe("request correlation", () => {
  it("continues an incoming W3C trace and echoes it", async () => {
    const { app } = await setup();

    const res = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { traceparent: INCOMING },
    });

    const traceparent = String(res.headers["traceparent"]);
    expect(traceparent).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
    expect(traceparent).not.toContain("00f067aa0ba902b7");
  });

  it("never trusts a client-supplied request id", async () => {
    const { app } = await setup();

    const res = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { "x-request-id": "attacker-chosen" },
    });

    expect(res.headers["x-request-id"]).toMatch(ULID);
  });

  it("writes one completion line carrying request_id, trace_id, route, status and duration", async () => {
    const { app, logs } = await setup();

    const res = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { traceparent: INCOMING },
    });

    const completion = logs().filter((l) => l["msg"] === "request completed");
    expect(completion).toHaveLength(1);
    expect(completion[0]).toMatchObject({
      level: "info",
      service: "api",
      request_id: res.headers["x-request-id"],
      trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
      method: "GET",
      route: "/healthz",
      status: 200,
    });
    expect(typeof completion[0]?.["duration_ms"]).toBe("number");
  });

  it("redacts a signature in the logged URL", async () => {
    const { app, logs } = await setup();

    await app.inject({ method: "GET", url: "/healthz?w=100&sig=SENTINEL-SIGNATURE" });

    expect(JSON.stringify(logs())).not.toContain("SENTINEL-SIGNATURE");
    expect(logs().find((l) => l["msg"] === "request completed")?.["url"]).toBe(
      "/healthz?w=100&sig=[redacted]",
    );
  });
});

describe("unknown routes", () => {
  it.each(["/nothing-here", "/v1/nothing-here"])(
    "returns 404 route_not_found for %s",
    async (url) => {
      const { app } = await setup();

      const res = await app.inject({ method: "GET", url });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: "route_not_found", details: [] } });
      expect(res.json<{ error: { request_id: string } }>().error.request_id).toMatch(ULID);
    },
  );
});
