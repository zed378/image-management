import { beforeAll, describe, expect, it } from "vitest";

import { createLogger } from "@image-delivery/logger";

import { buildApp } from "../src/app";
import { stubApiKeys } from "./support/stub-api-keys";
import { createFailureLimiter } from "../src/http/failure-limiter";

import type { FastifyInstance } from "fastify";

// P1-03: every /v1 route requires a credential unless declared public;
// 401 and 403 are distinct; a route that declares neither fails to register.

const T = "01HZZZZZZZZZZZZZZZZZZZZZT1";
const A = "01HZZZZZZZZZZZZZZZZZZZZZA1";
const READER = "ak_live_reader";
const principal = { keyId: "K1", tenantId: T, applicationId: A, projectAccess: "all" as const };

const quietLogger = () =>
  createLogger({
    service: "api",
    version: "test",
    level: "silent",
    destination: { write: () => undefined },
  });

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    logger: quietLogger(),
    readinessChecks: {},
    apiKeys: stubApiKeys({ [READER]: { ...principal, permissions: ["thing:read"] } }),
    authFailures: createFailureLimiter({ maxFailures: 3, windowMs: 60_000 }),
    registerExtraRoutes: (v1) => {
      // A route added "later": it declares only a permission, and is
      // protected without doing anything else.
      v1.get("/things", { config: { permission: "thing:read" } }, (request) => ({
        tenant: request.tenant?.tenantId,
        actor: request.tenant?.actor,
        application: request.tenant?.applicationId,
      }));
      v1.post("/things", { config: { permission: "thing:create" } }, () => ({ ok: true }));
      v1.get("/public-thing", { config: { public: true } }, () => ({ public: true }));
    },
  });
});

const errorOf = (res: { json: () => unknown }) =>
  (res.json() as { error: { code: string } }).error.code;

describe("authentication by default", () => {
  it("refuses a request without Authorization with 401 authentication_required and a challenge", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/things", remoteAddress: "10.0.0.1" });

    expect(res.statusCode).toBe(401);
    expect(errorOf(res)).toBe("authentication_required");
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="api"');
  });

  it("refuses a scheme other than Bearer the same way", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/things",
      remoteAddress: "10.0.0.2",
      headers: { authorization: `Basic ${READER}` },
    });

    expect(res.statusCode).toBe(401);
    expect(errorOf(res)).toBe("authentication_required");
  });

  it("refuses an invalid key with 401 api_key_invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/things",
      remoteAddress: "10.0.0.3",
      headers: { authorization: "Bearer ak_live_nope" },
    });

    expect(res.statusCode).toBe(401);
    expect(errorOf(res)).toBe("api_key_invalid");
    expect(res.headers["www-authenticate"]).toBe('Bearer realm="api"');
  });

  it("builds the tenant context from the verified key only", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/things?tenant_id=01HZZZZZZZZZZZZZZZZZZZZZT9",
      remoteAddress: "10.0.0.4",
      headers: { authorization: `bearer ${READER}`, "x-tenant-id": "01HZZZZZZZZZZZZZZZZZZZZZT9" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      tenant: T,
      actor: { type: "api_key", id: "K1" },
      application: A,
    });
  });

  it("answers 403 permission_denied to an authenticated key without the permission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/things",
      remoteAddress: "10.0.0.5",
      headers: { authorization: `Bearer ${READER}` },
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(errorOf(res)).toBe("permission_denied");
  });

  it("rejects an unauthenticated request before reading its body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/things",
      remoteAddress: "10.0.0.6",
      headers: { "content-type": "application/json" },
      payload: '{"not": valid json',
    });

    expect(res.statusCode).toBe(401);
  });

  it("serves a route declared public without a credential", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/public-thing" });

    expect(res.statusCode).toBe(200);
  });

  it("protects the API-key management routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/applications/${A}/api-keys`,
      remoteAddress: "10.0.0.7",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("when the credential store is down", () => {
  it("answers 503 service_unavailable, never 401", async () => {
    const down = await buildApp({
      logger: quietLogger(),
      readinessChecks: {},
      apiKeys: {
        ...stubApiKeys(),
        authenticate: () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.9:5432")),
      },
      registerExtraRoutes: (v1) => {
        v1.get("/things", { config: { permission: "thing:read" } }, () => ({}));
      },
    });

    const res = await down.inject({
      method: "GET",
      url: "/v1/things",
      headers: { authorization: `Bearer ${READER}` },
    });

    expect(res.statusCode).toBe(503);
    expect(errorOf(res)).toBe("service_unavailable");
    expect(res.headers["retry-after"]).toBe("5");
    expect(res.body).not.toContain("10.0.0.9");
  });
});

describe("the route contract (SEC-AZ-01)", () => {
  it("refuses to register a /v1 route that declares neither a permission nor public", async () => {
    await expect(
      buildApp({
        logger: quietLogger(),
        readinessChecks: {},
        apiKeys: stubApiKeys(),
        registerExtraRoutes: (v1) => {
          v1.get("/forgotten", () => ({}));
        },
      }),
    ).rejects.toThrow(/declares neither a permission nor public: true/);
  });
});

describe("failed-authentication limiting", () => {
  it("blocks an address after repeated failures, with Retry-After, even for a valid key", async () => {
    const attempt = (authorization: string) =>
      app.inject({
        method: "GET",
        url: "/v1/things",
        remoteAddress: "10.9.9.9",
        headers: { authorization },
      });

    for (let i = 0; i < 3; i += 1) {
      expect((await attempt("Bearer ak_live_wrong")).statusCode).toBe(401);
    }
    const blocked = await attempt(`Bearer ${READER}`);

    expect(blocked.statusCode).toBe(429);
    expect(errorOf(blocked)).toBe("rate_limited");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("does not count successes, and does not affect other addresses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/things",
      remoteAddress: "10.9.9.10",
      headers: { authorization: `Bearer ${READER}` },
    });

    expect(res.statusCode).toBe(200);
  });
});
