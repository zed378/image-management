import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { newId } from "@image-delivery/schema";

import { registerAuthentication } from "./http/authentication";
import { registerErrorHandler } from "./http/error-handler";
import { registerRequestContext } from "./http/request-context";
import { sendError } from "./http/respond";
import { registerApiKeyRoutes } from "./modules/api-keys/api-key.routes";
import { registerHealthRoutes, type ReadinessCheck } from "./modules/health/health.routes";

import type { FailureLimiter } from "./http/failure-limiter";
import type { ApiKeyService } from "./modules/api-keys/api-key.service";
import type { Logger } from "@image-delivery/logger";

// Composition only (docs/ENGINEERING/02): build the Fastify instance, mount
// middleware and routes. No I/O here -- server.ts connects dependencies and
// listens; integration tests call buildApp() and never bind a port.

export type AppOptions = {
  readonly logger: Logger;
  readonly readinessChecks: Readonly<Record<string, ReadinessCheck>>;
  /** Trust X-Forwarded-* from these proxy addresses/CIDRs (the load balancer), or all. */
  readonly trustProxy?: boolean | string | readonly string[];
  readonly apiKeys: ApiKeyService;
  /** Failed-authentication limiter (tests inject one with a small budget). */
  readonly authFailures?: FailureLimiter;
  /** Extra /v1 routes, registered after authentication (tests). */
  readonly registerExtraRoutes?: (v1: FastifyInstance) => void;
  /** Observes every route as it registers (the P1-06 route-table gate). */
  readonly onRoute?: (route: { readonly method: string; readonly url: string }) => void;
};

export const API_VERSION_PREFIX = "/v1";

export const buildApp = async (options: AppOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    // Widened to FastifyBaseLogger so the instance keeps Fastify's default
    // logger generic: otherwise it is typed FastifyInstance<..., pino.Logger>
    // and is not assignable where plugins expect the default FastifyInstance.
    // Sound: a pino Logger satisfies FastifyBaseLogger.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- widens the generic, see above
    loggerInstance: options.logger as FastifyBaseLogger,
    // Our own completion line (request-context.ts) replaces Fastify's pair of
    // "incoming request" / "request completed" lines; the request id is
    // logged as request_id to match the field vocabulary (docs/ENGINEERING/12).
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: "request_id",
    }),
    // Always generate the request id; a client-supplied id is never trusted
    // as a correlation key.
    genReqId: () => newId(),
    requestIdHeader: false,
    trustProxy:
      typeof options.trustProxy === "object"
        ? [...options.trustProxy]
        : (options.trustProxy ?? false),
    // 1 MiB for JSON bodies; uploads use multipart or presigned URLs.
    bodyLimit: 1024 * 1024,
  });

  if (options.onRoute) {
    const observe = options.onRoute;
    app.addHook("onRoute", (route) => {
      for (const method of [route.method].flat()) observe({ method, url: route.url });
    });
  }

  registerRequestContext(app);
  registerErrorHandler(app);
  registerHealthRoutes(app, options.readinessChecks);

  // Every versioned route lives under /v1 (docs/API/04-API-VERSIONING.md).
  // Authentication is registered first inside the scope, so every route
  // after it -- every module -- is protected by default (P1-03).
  await app.register(
    async (v1) => {
      registerAuthentication(v1, {
        authenticate: options.apiKeys.authenticate,
        ...(options.authFailures ? { failures: options.authFailures } : {}),
      });
      registerApiKeyRoutes(v1, options.apiKeys);
      options.registerExtraRoutes?.(v1);
    },
    { prefix: API_VERSION_PREFIX },
  );

  app.setNotFoundHandler((request, reply) => sendError(request, reply, "route_not_found"));

  return app;
};
