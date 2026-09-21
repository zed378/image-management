import { z } from "zod";

import { ULID_PATTERN } from "@image-delivery/schema";

import { toApiKeyWire } from "./api-key.mapper";
import { createApiKeyBodySchema, rotateApiKeyBodySchema } from "./api-key.schema";
import { tenantOf } from "../../http/authentication";
import { created, ok } from "../../http/respond";

import type { ApiKeyService } from "./api-key.service";
import type { FastifyInstance } from "fastify";

// /v1/applications/:application_id/api-keys (docs/API/02 "Managing keys").
// The route layer: parse, call the service, respond. No rules, no queries,
// no try/catch -- a thrown AppError or ZodError reaches the error handler.
// Every route declares its permission (SEC-AZ-01); authentication and the
// permission check run in hooks before the handler (http/authentication.ts).

const applicationParams = z.object({ application_id: z.string().regex(ULID_PATTERN) }).strict();
const keyParams = applicationParams.extend({ key_id: z.string().regex(ULID_PATTERN) }).strict();

const BASE = "/applications/:application_id/api-keys";

export const registerApiKeyRoutes = (app: FastifyInstance, apiKeys: ApiKeyService): void => {
  app.post(BASE, { config: { permission: "api-key:create" } }, async (request, reply) => {
    const { application_id } = applicationParams.parse(request.params);
    const body = createApiKeyBodySchema.parse(request.body);

    const issued = await apiKeys.create(tenantOf(request), application_id, body);

    // The only response that ever carries the plaintext key.
    return created(
      request,
      reply,
      { ...toApiKeyWire(issued.apiKey), key: issued.plaintext },
      `/v1/applications/${application_id}/api-keys/${issued.apiKey.id}`,
    );
  });

  app.get(BASE, { config: { permission: "api-key:read" } }, async (request, reply) => {
    const { application_id } = applicationParams.parse(request.params);

    const keys = await apiKeys.list(tenantOf(request), application_id);

    return ok(request, reply, keys.map(toApiKeyWire));
  });

  app.get(`${BASE}/:key_id`, { config: { permission: "api-key:read" } }, async (request, reply) => {
    const { application_id, key_id } = keyParams.parse(request.params);

    const key = await apiKeys.get(tenantOf(request), application_id, key_id);

    return ok(request, reply, toApiKeyWire(key));
  });

  app.post(
    `${BASE}/:key_id/rotate`,
    { config: { permission: "api-key:update" } },
    async (request, reply) => {
      const { application_id, key_id } = keyParams.parse(request.params);
      const body = rotateApiKeyBodySchema.parse(request.body ?? {});

      const issued = await apiKeys.rotate(tenantOf(request), application_id, key_id, body);

      return created(
        request,
        reply,
        { ...toApiKeyWire(issued.apiKey), key: issued.plaintext },
        `/v1/applications/${application_id}/api-keys/${issued.apiKey.id}`,
      );
    },
  );

  app.post(
    `${BASE}/:key_id/revoke`,
    { config: { permission: "api-key:delete" } },
    async (request, reply) => {
      const { application_id, key_id } = keyParams.parse(request.params);

      const key = await apiKeys.revoke(tenantOf(request), application_id, key_id);

      return ok(request, reply, toApiKeyWire(key));
    },
  );
};
