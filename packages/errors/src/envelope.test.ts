import { describe, expect, it } from "vitest";

import { errorEnvelope, successEnvelope } from "./envelope";

describe("successEnvelope", () => {
  it("nests data and puts request_id in meta", () => {
    expect(successEnvelope({ id: "a" }, "r1")).toEqual({
      data: { id: "a" },
      meta: { request_id: "r1" },
    });
  });

  it("merges extra meta without letting it override request_id", () => {
    expect(successEnvelope([], "r1", { next_cursor: "c", request_id: "spoofed" })).toEqual({
      data: [],
      meta: { next_cursor: "c", request_id: "r1" },
    });
  });
});

describe("errorEnvelope", () => {
  it("nests the error and never includes data", () => {
    const body = errorEnvelope("asset_not_found", "No such asset.", "r1");

    expect(body).toEqual({
      error: { code: "asset_not_found", message: "No such asset.", details: [], request_id: "r1" },
    });
    expect("data" in body).toBe(false);
  });
});
