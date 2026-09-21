import {
  continueOrStartTrace,
  formatTraceparent,
  redactUrl,
  type TraceContext,
} from "@image-delivery/logger";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Per-request correlation (docs/OBSERVABILITY/01, 03):
//
//   request_id  a ULID generated here for every request (never trusted from
//               the client), bound on every log line, echoed as X-Request-Id
//   trace_id    continued from an incoming W3C traceparent, else started;
//               bound on every log line, echoed as traceparent
//
// One completion line per request, with the URL passed through redactUrl so
// a signed or presigned URL never reaches the log store.

declare module "fastify" {
  interface FastifyRequest {
    traceContext: TraceContext;
  }
}

export const registerRequestContext = (app: FastifyInstance): void => {
  app.decorateRequest("traceContext", null as unknown as TraceContext);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // A repeated header arrives as an array; W3C says use the first value.
    const header = request.headers["traceparent"];
    const trace = continueOrStartTrace(Array.isArray(header) ? header[0] : header);
    request.traceContext = trace;
    request.log = request.log.child({ trace_id: trace.traceId, span_id: trace.spanId });
    reply.header("x-request-id", request.id);
    reply.header("traceparent", formatTraceparent(trace));
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const status = reply.statusCode;
    const line = {
      method: request.method,
      route: request.routeOptions.url ?? "(unmatched)",
      url: redactUrl(request.url),
      status,
      duration_ms: Math.round(reply.elapsedTime * 100) / 100,
    };
    // 5xx is an error; 4xx is the system working (docs/ENGINEERING/12).
    if (status >= 500) request.log.error(line, "request completed");
    else request.log.info(line, "request completed");
  });
};
