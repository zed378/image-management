import type { Logger } from "@image-delivery/logger";
import { newId } from "@image-delivery/schema";
import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { registerRequestContext } from "./http/request-context";
import { sendError } from "./http/respond";
import { registerHealthRoutes, type ReadinessCheck } from "./modules/health/health.routes";

// Composition only (docs/ENGINEERING/02): build the Fastify instance, mount
// middleware and routes. No I/O here -- server.ts connects dependencies and
// listens; integration tests call buildApp() and never bind a port.

export type AppOptions = {
  readonly logger: Logger;
  readonly readinessChecks: Readonly<Record<string, ReadinessCheck>>;
  /** Trust X-Forwarded-* from these proxy addresses/CIDRs (the load balancer), or all. */
  readonly trustProxy?: boolean | string | readonly string[];
};

export const API_VERSION_PREFIX = "/v1";

export const buildApp = async (options: AppOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    // Widened to FastifyBaseLogger so the instance keeps Fastify's default
    // logger generic: otherwise it is typed FastifyInstance<..., pino.Logger>
    // and is not assignable where plugins expect the default FastifyInstance.
    // Sound: a pino Logger satisfies FastifyBaseLogger.
    loggerInstance: options.logger as FastifyBaseLogger,
    // Our own completion line (request-context.ts) replaces Fastify's pair of
    // "incoming request" / "request completed" lines; the request id is
    // logged as request_id to match the field vocabulary (docs/ENGINEERING/12).
    logController: new LogController({ disableRequestLogging: true, requestIdLogLabel: "request_id" }),
    // Always generate the request id; a client-supplied id is never trusted
    // as a correlation key.
    genReqId: () => newId(),
    requestIdHeader: false,
    trustProxy: typeof options.trustProxy === "object" ? [...options.trustProxy] : (options.trustProxy ?? false),
    // 1 MiB for JSON bodies; uploads use multipart or presigned URLs.
    bodyLimit: 1024 * 1024,
  });

  registerRequestContext(app);
  registerHealthRoutes(app, options.readinessChecks);

  // Every versioned route lives under /v1 (docs/API/04-API-VERSIONING.md).
  await app.register(async () => {
    // Modules register here as they land (P1-02 onward).
  }, { prefix: API_VERSION_PREFIX });

  app.setNotFoundHandler((request, reply) =>
    sendError(request, reply, 404, "route_not_found", "No route matches this method and path."),
  );

  return app;
};
