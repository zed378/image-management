import { randomBytes } from "node:crypto";

// W3C Trace Context (https://www.w3.org/TR/trace-context/), the `traceparent`
// header: `00-<32 hex trace-id>-<16 hex parent-id>-<2 hex flags>`.
//
// P0-05 propagates the trace id through logs, HTTP, and queue payloads so a
// request can be followed across both deployables. P7-03 hands the same ids
// to OpenTelemetry; the wire format does not change.

export type TraceContext = {
  readonly traceId: string;
  readonly spanId: string;
  readonly sampled: boolean;
};

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ALL_ZERO_TRACE = "0".repeat(32);
const ALL_ZERO_SPAN = "0".repeat(16);

const hex = (bytes: number): string => randomBytes(bytes).toString("hex");

/**
 * Parse an incoming `traceparent`. Returns null for anything malformed,
 * including the all-zero ids the spec declares invalid -- a malformed header
 * starts a new trace rather than propagating garbage.
 */
export const parseTraceparent = (header: string | undefined): TraceContext | null => {
  if (!header) return null;
  const match = TRACEPARENT.exec(header.trim().toLowerCase());
  if (!match) return null;
  const [, traceId, spanId, flags] = match as unknown as [string, string, string, string];
  if (traceId === ALL_ZERO_TRACE || spanId === ALL_ZERO_SPAN) return null;
  return { traceId, spanId, sampled: (Number.parseInt(flags, 16) & 0x01) === 0x01 };
};

/** A new root trace. */
export const newTraceContext = (sampled = true): TraceContext => ({
  traceId: hex(16),
  spanId: hex(8),
  sampled,
});

/** Continue `parent`'s trace in a new span (a new hop: HTTP call, job, ...). */
export const childSpan = (parent: TraceContext): TraceContext => ({
  traceId: parent.traceId,
  spanId: hex(8),
  sampled: parent.sampled,
});

/** Continue an incoming trace, or start one when there is none. */
export const continueOrStartTrace = (header: string | undefined): TraceContext => {
  const parent = parseTraceparent(header);
  return parent ? childSpan(parent) : newTraceContext();
};

export const formatTraceparent = (ctx: TraceContext): string =>
  `00-${ctx.traceId}-${ctx.spanId}-${ctx.sampled ? "01" : "00"}`;
