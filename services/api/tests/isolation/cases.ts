import { systemContext } from "@image-delivery/tenancy";

import type { IsolationCase } from "./harness";

// Every route that takes a resource id, and how to create that resource.
// P1-06's gate fails when a /v1 route with a path parameter has no case here.

const issueKey = async (
  owner: Parameters<IsolationCase["arrange"]>[0],
  deps: Parameters<IsolationCase["arrange"]>[1],
) =>
  deps.apiKeys.create(systemContext(owner.tenantId), owner.applicationId, {
    name: "victim",
    environment: "live",
    permissions: ["asset:read"],
    all_projects: true,
    project_ids: [],
  });

export const ISOLATION_CASES: readonly IsolationCase[] = [
  {
    route: "GET /v1/applications/:application_id/api-keys",
    arrange: (owner) => Promise.resolve({ application_id: owner.applicationId }),
  },
  {
    route: "POST /v1/applications/:application_id/api-keys",
    arrange: (owner) => Promise.resolve({ application_id: owner.applicationId }),
    payload: { name: "x", environment: "live", permissions: ["asset:read"], all_projects: true },
  },
  {
    route: "GET /v1/applications/:application_id/api-keys/:key_id",
    arrange: async (owner, deps) => ({
      application_id: owner.applicationId,
      key_id: (await issueKey(owner, deps)).apiKey.id,
    }),
  },
  {
    route: "POST /v1/applications/:application_id/api-keys/:key_id/rotate",
    arrange: async (owner, deps) => ({
      application_id: owner.applicationId,
      key_id: (await issueKey(owner, deps)).apiKey.id,
    }),
  },
  {
    route: "POST /v1/applications/:application_id/api-keys/:key_id/revoke",
    arrange: async (owner, deps) => ({
      application_id: owner.applicationId,
      key_id: (await issueKey(owner, deps)).apiKey.id,
    }),
  },
];
