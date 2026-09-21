import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { ERROR_CODES, isErrorCode, type ErrorCode } from "./codes";

const codes = Object.keys(ERROR_CODES) as ErrorCode[];

describe("the error-code registry", () => {
  it.each(codes)("%s is snake_case, has a 4xx/5xx status and a sentence-case message", (code) => {
    const spec = ERROR_CODES[code];

    expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/);
    expect(spec.status).toBeGreaterThanOrEqual(400);
    expect(spec.status).toBeLessThan(600);
    expect(spec.message).toMatch(/^[A-Z].*\.$/);
  });

  it("marks every 5xx except internal_error as retryable, and internal_error as not", () => {
    for (const code of codes) {
      const { status, retryable } = ERROR_CODES[code];
      if (status >= 500) expect(retryable, code).toBe(code !== "internal_error");
    }
  });

  it("distinguishes a rate limit (retryable) from a quota (not) at the same status", () => {
    expect(ERROR_CODES.rate_limited).toMatchObject({ status: 429, retryable: true });
    expect(ERROR_CODES.quota_exceeded).toMatchObject({ status: 429, retryable: false });
  });

  it("recognizes registered codes only", () => {
    expect(isErrorCode("asset_not_found")).toBe(true);
    expect(isErrorCode("toString")).toBe(false);
    expect(isErrorCode("made_up_code")).toBe(false);
  });
});

describe("AppError", () => {
  it("takes its status and retryability from the registry", () => {
    const err = new AppError("asset_not_found");

    expect(err).toMatchObject({ code: "asset_not_found", status: 404, retryable: false, details: [] });
    expect(err.message).toBe("No asset with that id exists.");
  });

  it("exposes a specific message on a 4xx", () => {
    const err = new AppError("invalid_transform_param", {
      message: "Parameter 'w' must be between 1 and 8192.",
      details: [{ field: "w", reason: "out_of_range" }],
    });

    expect(err.publicMessage).toBe("Parameter 'w' must be between 1 and 8192.");
    expect(err.details).toEqual([{ field: "w", reason: "out_of_range" }]);
  });

  it("never exposes a specific message on a 5xx", () => {
    const err = new AppError("storage_unavailable", { message: "connect ECONNREFUSED 10.0.3.7:9000" });

    expect(err.expose).toBe(false);
    expect(err.publicMessage).toBe("Storage is temporarily unavailable.");
  });

  it("keeps the cause for logs", () => {
    const cause = new Error("root cause");

    expect(new AppError("internal_error", { cause }).cause).toBe(cause);
  });
});
