import type { IsolationCase } from "./harness";

// P1-06: the route table decides what must be isolation-tested, not a
// hand-kept list. Any /v1 route with a path parameter is a route that
// addresses a resource by id, and needs a case.

export type RegisteredRoute = { readonly method: string; readonly url: string };

const key = (r: RegisteredRoute) => `${r.method} ${r.url}`;

/** Routes that take an id and have no isolation case. */
export const routesMissingIsolation = (
  routes: readonly RegisteredRoute[],
  cases: readonly IsolationCase[],
): string[] => {
  const covered = new Set(cases.map((c) => c.route));
  return (
    routes
      .filter((r) => r.url.startsWith("/v1/") && r.url.includes("/:"))
      // HEAD is registered automatically for every GET and addresses the same resource.
      .filter((r) => r.method !== "HEAD")
      .map(key)
      .filter((k) => !covered.has(k))
  );
};

/** Cases whose route no longer exists (a renamed route would otherwise go untested). */
export const staleIsolationCases = (
  routes: readonly RegisteredRoute[],
  cases: readonly IsolationCase[],
): string[] => {
  const registered = new Set(routes.map(key));
  return cases.map((c) => c.route).filter((r) => !registered.has(r));
};
