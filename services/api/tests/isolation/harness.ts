import { systemContext, PERMISSIONS } from "@image-delivery/tenancy";
import { seedTenant, type SeededTenant } from "@image-delivery/test-utils";

import type { ApiKeyService } from "../../src/modules/api-keys/api-key.service";
import type { Db } from "@image-delivery/db";
import type { FastifyInstance } from "fastify";

// The tenant-isolation harness (P1-05, docs/SECURITY/11). For any route that
// addresses a resource by id: create the resource in tenant A, request it
// with tenant B's all-powerful key -> 404, then with A's key -> not 404.
// The second call is what keeps a case honest: a request that 404s for
// everyone proves nothing about isolation.

export type TenantFixture = SeededTenant & {
  /** A key holding every permission, covering every project. */
  readonly key: string;
};

export type IsolationDeps = {
  readonly db: Db;
  readonly apiKeys: ApiKeyService;
};

export type IsolationCase = {
  /** Method and route exactly as registered, e.g. `GET /v1/applications/:application_id/api-keys`. */
  readonly route: string;
  /** Create the resource in `owner`'s tenant; return every path parameter of the route. */
  readonly arrange: (owner: TenantFixture, deps: IsolationDeps) => Promise<Record<string, string>>;
  readonly payload?: Record<string, unknown>;
};

export const createTenantFixture = async (deps: IsolationDeps): Promise<TenantFixture> => {
  const tenant = await seedTenant(deps.db);
  const issued = await deps.apiKeys.create(systemContext(tenant.tenantId), tenant.applicationId, {
    name: "isolation-harness",
    environment: "live",
    permissions: [...PERMISSIONS],
    all_projects: true,
    project_ids: [],
  });
  return { ...tenant, key: issued.plaintext };
};

const toRequest = (route: string, params: Record<string, string>) => {
  const [method, template] = route.split(" ") as [
    "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    string,
  ];
  const url = template.replace(/:([a-z_]+)/g, (_m, name: string) => {
    const value = params[name];
    if (value === undefined)
      throw new Error(`isolation case ${route}: arrange() did not return :${name}`);
    return value;
  });
  return { method, url };
};

export type IsolationOutcome = { readonly attacker: number; readonly owner: number };

export const runIsolationCase = async (
  app: FastifyInstance,
  deps: IsolationDeps,
  owner: TenantFixture,
  attacker: TenantFixture,
  testCase: IsolationCase,
): Promise<IsolationOutcome> => {
  const params = await testCase.arrange(owner, deps);
  const { method, url } = toRequest(testCase.route, params);
  const send = (key: string) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${key}` },
      ...(method === "GET" || method === "DELETE" ? {} : { payload: testCase.payload ?? {} }),
    });
  // Attacker first, so a mutating route is attempted against intact state.
  const attackerResponse = await send(attacker.key);
  const ownerResponse = await send(owner.key);
  return { attacker: attackerResponse.statusCode, owner: ownerResponse.statusCode };
};
