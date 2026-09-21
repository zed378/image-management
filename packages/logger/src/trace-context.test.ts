import { describe, expect, it } from "vitest";

import {
  childSpan,
  continueOrStartTrace,
  formatTraceparent,
  newTraceContext,
  parseTraceparent,
} from "./trace-context";

const VALID = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("parseTraceparent", () => {
  it("parses a valid W3C traceparent", () => {
    expect(parseTraceparent(VALID)).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      sampled: true,
    });
  });

  it("reads the sampled flag", () => {
    expect(parseTraceparent(VALID.replace(/01$/, "00"))?.sampled).toBe(false);
  });

  it("normalizes case", () => {
    expect(parseTraceparent(VALID.toUpperCase())?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["wrong version", "01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"],
    ["short trace id", "00-4bf92f35-00f067aa0ba902b7-01"],
    ["non-hex", "00-zzf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"],
    ["all-zero trace id", `00-${"0".repeat(32)}-00f067aa0ba902b7-01`],
    ["all-zero span id", `00-4bf92f3577b34da6a3ce929d0e0e4736-${"0".repeat(16)}-01`],
    ["injection attempt", `${VALID}\ninjected: header`],
  ])("rejects a %s header", (_case, header) => {
    expect(parseTraceparent(header)).toBeNull();
  });
});

describe("trace continuation", () => {
  it("keeps the trace id and issues a new span id for a child", () => {
    const parent = newTraceContext();

    const child = childSpan(parent);

    expect(child.traceId).toBe(parent.traceId);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it("continues an incoming trace", () => {
    expect(continueOrStartTrace(VALID).traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("starts a new trace when the incoming header is malformed", () => {
    const ctx = continueOrStartTrace("garbage");

    expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("round-trips through format and parse", () => {
    const ctx = newTraceContext(false);

    expect(parseTraceparent(formatTraceparent(ctx))).toEqual(ctx);
  });
});
