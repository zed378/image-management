import { describe, expect, it } from "vitest";

import { createLogger } from "@image-delivery/logger";

import { ISOLATION_CASES } from "./isolation/cases";
import {
  routesMissingIsolation,
  staleIsolationCases,
  type RegisteredRoute,
} from "./isolation/coverage";
import { stubApiKeys } from "./support/stub-api-keys";
import { stubAssets } from "./support/stub-assets";
import { buildApp } from "../src/app";

// P1-06 DoD: adding a /v1 route that takes an id without an isolation case
// fails the build by construction. The route table is read from the real
// application as it registers, so a new route cannot be forgotten.

const registeredRoutes = async (
  extra?: Parameters<typeof buildApp>[0]["registerExtraRoutes"],
): Promise<RegisteredRoute[]> => {
  const routes: RegisteredRoute[] = [];
  await buildApp({
    logger: createLogger({ service: "api", version: "test", level: "silent" }),
    readinessChecks: {},
    apiKeys: stubApiKeys(),
    assets: stubAssets(),
    onRoute: (r) => routes.push(r),
    ...(extra ? { registerExtraRoutes: extra } : {}),
  });
  return routes;
};

describe("the IDOR/BOLA route gate", () => {
  it("finds an isolation case for every /v1 route that takes an id", async () => {
    expect(routesMissingIsolation(await registeredRoutes(), ISOLATION_CASES)).toEqual([]);
  });

  it("has no case for a route that no longer exists", async () => {
    expect(staleIsolationCases(await registeredRoutes(), ISOLATION_CASES)).toEqual([]);
  });

  it("fails for a newly added id route without a case (the gate fires)", async () => {
    const routes = await registeredRoutes((v1) => {
      v1.get("/assets/:asset_id", { config: { permission: "asset:read" } }, () => ({}));
    });

    expect(routesMissingIsolation(routes, ISOLATION_CASES)).toEqual(["GET /v1/assets/:asset_id"]);
  });

  it("ignores routes without a path parameter", async () => {
    const routes = await registeredRoutes((v1) => {
      v1.get("/assets", { config: { permission: "asset:read" } }, () => ({}));
    });

    expect(routesMissingIsolation(routes, ISOLATION_CASES)).toEqual([]);
  });
});
