import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@image-delivery/errors";

import { toAppError } from "../src/http/error-handler";

// The mapping in docs/API/05-ERROR-HANDLING.md "Validation reasons" and
// "Framework failures", branch by branch. The end-to-end behavior (status, envelope, no
// leaks) is in error-handling.test.ts; this pins each input shape.

const fastifyError = (props: Record<string, unknown>) =>
  Object.assign(new Error("framework"), props);

describe("toAppError", () => {
  it("passes an AppError through untouched", () => {
    const err = new AppError("asset_not_found");

    expect(toAppError(err)).toBe(err);
  });

  it("maps a Zod issue without a path to a reason-only detail", () => {
    const result = z.string().safeParse(42);
    if (result.success) throw new Error("expected a failure");

    expect(toAppError(result.error)).toMatchObject({
      code: "validation_failed",
      details: [{ reason: "invalid_type" }],
    });
  });

  it.each([
    [
      "a missing property",
      { instancePath: "", keyword: "required", params: { missingProperty: "name" } },
      { field: "name", reason: "required" },
    ],
    [
      "an unknown property, nested",
      {
        instancePath: "/meta",
        keyword: "additionalProperties",
        params: { additionalProperty: "x" },
      },
      { field: "meta.x", reason: "additionalProperties" },
    ],
    [
      "a nested value",
      { instancePath: "/items/0/w", keyword: "maximum", params: {} },
      { field: "items.0.w", reason: "maximum" },
    ],
    ["a root-level failure", { instancePath: "", keyword: "type", params: {} }, { reason: "type" }],
    ["an issue with no keyword", { instancePath: "/w" }, { field: "w", reason: "invalid" }],
    ["an issue with nothing at all", {}, { reason: "invalid" }],
  ])("maps a route-schema failure on %s", (_name, issue, detail) => {
    const err = fastifyError({ validation: [issue], statusCode: 400 });

    expect(toAppError(err)).toMatchObject({ code: "validation_failed", details: [detail] });
  });

  it.each([
    ["FST_ERR_CTP_BODY_TOO_LARGE", "payload_too_large"],
    ["FST_ERR_CTP_INVALID_MEDIA_TYPE", "unsupported_media_type"],
    ["FST_ERR_CTP_INVALID_CONTENT_LENGTH", "validation_failed"],
    ["FST_ERR_CTP_EMPTY_JSON_BODY", "malformed_json"],
    ["FST_ERR_CTP_INVALID_JSON_BODY", "malformed_json"],
  ])("maps %s to %s, keeping the cause for the log", (code, expected) => {
    const err = fastifyError({ code });

    const mapped = toAppError(err);

    expect(mapped.code).toBe(expected);
    expect(mapped.cause).toBe(err);
  });

  it("maps the JSON parser's 400 SyntaxError to malformed_json", () => {
    const err = Object.assign(new SyntaxError("Unexpected end of JSON input"), { statusCode: 400 });

    expect(toAppError(err).code).toBe("malformed_json");
  });

  it("does not treat an application SyntaxError as a client error", () => {
    expect(toAppError(new SyntaxError("bad regex in our own code")).code).toBe("internal_error");
  });

  it.each([
    ["an unmapped framework code", fastifyError({ code: "FST_ERR_SOMETHING_NEW" })],
    ["a thrown string", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("maps %s to internal_error", (_name, thrown) => {
    expect(toAppError(thrown)).toMatchObject({ code: "internal_error", status: 500 });
  });
});
