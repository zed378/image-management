import type { FastifyInstance } from "fastify";

import { ok, sendError } from "../../http/respond";

// Probes (docs/ARCHITECTURE/04-API-GATEWAY.md). Unauthenticated by design --
// orchestrators call them -- so they reveal only check names and ok/failing,
// never hostnames, versions, or error messages.
//
//   /healthz  liveness: the process can serve HTTP. Checks nothing external,
//             so a database outage does not make the orchestrator kill and
//             restart every healthy api replica.
//   /readyz   readiness: every dependency answers. Failing removes the
//             replica from the load balancer until it recovers.

export type ReadinessCheck = () => Promise<void>;

export const READINESS_TIMEOUT_MS = 2_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });

export const registerHealthRoutes = (
  app: FastifyInstance,
  checks: Readonly<Record<string, ReadinessCheck>>,
): void => {
  // Public: no authentication, by design (probes).
  app.get("/healthz", async (request, reply) => ok(request, reply, { status: "ok" }));

  // Public: no authentication, by design (probes).
  app.get("/readyz", async (request, reply) => {
    const names = Object.keys(checks);
    const results = await Promise.allSettled(
      names.map((name) => withTimeout((checks[name] ?? (() => Promise.resolve()))(), READINESS_TIMEOUT_MS)),
    );
    const report: Record<string, "ok" | "failing"> = {};
    const failing: string[] = [];
    results.forEach((result, i) => {
      const name = names[i] ?? "unknown";
      report[name] = result.status === "fulfilled" ? "ok" : "failing";
      if (result.status === "rejected") {
        failing.push(name);
        request.log.warn({ check: name, err: result.reason as unknown }, "readiness check failed");
      }
    });

    if (failing.length > 0) {
      return sendError(
        request,
        reply,
        503,
        "service_unavailable",
        "One or more dependencies are unavailable.",
        failing.map((name) => ({ field: name, reason: "failing" })),
      );
    }
    return ok(request, reply, { status: "ready", checks: report });
  });
};
