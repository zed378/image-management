import { AppError } from "@image-delivery/errors";

import type { ApiKeyService } from "../../src/modules/api-keys/api-key.service";
import type { ApiKeyPrincipal } from "../../src/modules/api-keys/api-key.types";

// An ApiKeyService for app-level tests that need no database: authenticate
// accepts the tokens it was given; every management call is "not found".

export const stubApiKeys = (
  principals: Readonly<Record<string, ApiKeyPrincipal>> = {},
): ApiKeyService => {
  const notFound = () => Promise.reject(new AppError("api_key_not_found"));
  return {
    authenticate: (presented) => Promise.resolve(principals[presented] ?? null),
    create: notFound,
    list: () => Promise.resolve([]),
    get: notFound,
    rotate: notFound,
    revoke: notFound,
  };
};
