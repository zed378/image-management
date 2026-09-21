import { AppError } from "@image-delivery/errors";

import { createFailureLimiter, type FailureLimiter } from "./failure-limiter";

import type { ApiKeyPrincipal } from "../modules/api-keys/api-key.types";
import type { TenantContext } from "@image-delivery/tenancy";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Authentication and the route contract for everything under /v1
// (docs/API/02-AUTHENTICATION.md, P1-03; SEC-AZ-01).
//
//   - Every /v1 route requires a verified credential unless its config says
//     `public: true`. Opt-out, not opt-in: a new route is protected by
//     default, and forgetting the config fails closed.
//   - Every non-public route declares the permission it needs; a route
//     without one fails to register. So "which permission guards this?" is
//     answered by the route table, never by reading handler bodies.
//   - 401 means "who are you?", 403 "I know who you are, and no" -- the
//     distinction is kept exact (P1-03 step 2).
//   - The TenantContext is built here from the verified principal only.

declare module "fastify" {
  interface FastifyContextConfig {
    /** Reachable without a credential. Rare; each one is listed in docs/API/02. */
    public?: boolean;
    /** The permission a credential must hold (the P1-04 vocabulary). */
    permission?: string;
  }
  interface FastifyRequest {
    /** Set for every authenticated request; null only on a public route. */
    tenant: TenantContext | null;
  }
}

export type Authenticator = (presentedKey: string) => Promise<ApiKeyPrincipal | null>;

const BEARER = /^Bearer (\S+)$/iu;

/** RFC 6750: a 401 names the scheme. */
const challenge = (reply: FastifyReply): void => {
  reply.header("www-authenticate", 'Bearer realm="api"');
};

export const toTenantContext = (principal: ApiKeyPrincipal, requestId: string): TenantContext => ({
  tenantId: principal.tenantId,
  applicationId: principal.applicationId,
  projectId: null,
  actor: { type: "api_key", id: principal.keyId },
  permissions: new Set(principal.permissions),
  projectAccess: principal.projectAccess === "all" ? "all" : new Set(principal.projectAccess),
  requestId,
});

/** Throws permission_denied unless the request's context holds `permission`. */
export const requirePermission = (request: FastifyRequest, permission: string): TenantContext => {
  const ctx = request.tenant;
  if (!ctx) throw new AppError("authentication_required");
  if (!ctx.permissions.has(permission)) throw new AppError("permission_denied");
  return ctx;
};

/** The request's context; for handlers on non-public routes, where it always exists. */
export const tenantOf = (request: FastifyRequest): TenantContext => {
  if (!request.tenant) throw new AppError("authentication_required");
  return request.tenant;
};

export type AuthenticationOptions = {
  readonly authenticate: Authenticator;
  /** Failed-authentication limiter; a default in-memory one when omitted. */
  readonly failures?: FailureLimiter;
};

/** Register inside the /v1 scope: applies to every route registered after it there. */
export const registerAuthentication = (
  app: FastifyInstance,
  options: AuthenticationOptions,
): void => {
  const failures = options.failures ?? createFailureLimiter();

  app.decorateRequest("tenant", null);

  app.addHook("onRoute", (route) => {
    const config = route.config as { public?: boolean; permission?: string } | undefined;
    if (config?.public === true) return;
    if (!config?.permission) {
      throw new Error(
        `route ${route.method.toString()} ${route.url} declares neither a permission nor public: true (SEC-AZ-01)`,
      );
    }
  });

  // onRequest: before the body is read, so an unauthenticated upload is
  // refused without accepting its bytes.
  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.config.public === true) return;

    const blockedFor = failures.blockedForSeconds(request.ip);
    if (blockedFor > 0) {
      reply.header("retry-after", String(blockedFor));
      throw new AppError("rate_limited");
    }

    const header = request.headers.authorization;
    const presented = header ? BEARER.exec(header)?.[1] : undefined;
    if (!presented) {
      challenge(reply);
      throw new AppError("authentication_required");
    }

    let principal: ApiKeyPrincipal | null;
    try {
      principal = await options.authenticate(presented);
    } catch (err) {
      // The credential store is unreachable: that is our outage, not the
      // client's bad key. 503 (retryable), never 401 -- a 401 would tell a
      // client with a valid key to stop using it.
      throw new AppError("service_unavailable", { cause: err });
    }
    if (!principal) {
      failures.recordFailure(request.ip);
      challenge(reply);
      throw new AppError("api_key_invalid");
    }

    request.tenant = toTenantContext(principal, request.id);
    request.log = request.log.child({ tenant_id: principal.tenantId, key_id: principal.keyId });
  });

  // preHandler: after authentication and body parsing, before the handler.
  app.addHook("preHandler", async (request) => {
    const permission = request.routeOptions.config.permission;
    if (request.routeOptions.config.public === true || !permission) return;
    requirePermission(request, permission);
  });
};
