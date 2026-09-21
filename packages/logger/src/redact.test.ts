import { describe, expect, it } from "vitest";

import { REDACTED, redactUrl } from "./redact";

describe("redactUrl", () => {
  it.each([
    ["/i/abc?w=400&sig=deadbeef&exp=1700000000", `/i/abc?w=400&sig=${REDACTED}&exp=1700000000`],
    ["/i/abc?s=deadbeef", `/i/abc?s=${REDACTED}`],
    [
      "https://cdn.example.com/i/abc?signature=x&h=10",
      `https://cdn.example.com/i/abc?signature=${REDACTED}&h=10`,
    ],
    [
      "https://bucket.s3.amazonaws.com/k?X-Amz-Credential=AKIA%2F&X-Amz-Signature=abc&X-Amz-Expires=60",
      `https://bucket.s3.amazonaws.com/k?X-Amz-Credential=${REDACTED}&X-Amz-Signature=${REDACTED}&X-Amz-Expires=60`,
    ],
    ["/v1/assets?token=t0k&limit=10", `/v1/assets?token=${REDACTED}&limit=10`],
  ])("redacts access-granting parameters in %s", (input, expected) => {
    expect(redactUrl(input)).toBe(expected);
  });

  it("keeps transformation parameters intact, since they are what an operator debugs", () => {
    expect(redactUrl("/i/abc?w=800&h=600&fit=cover&f=auto")).toBe(
      "/i/abc?w=800&h=600&fit=cover&f=auto",
    );
  });

  it("returns a URL without a query string unchanged", () => {
    expect(redactUrl("/i/abc")).toBe("/i/abc");
  });

  it("drops a fragment rather than risk leaking one", () => {
    expect(redactUrl("/i/abc?w=1&sig=x#frag")).toBe(`/i/abc?w=1&sig=${REDACTED}`);
  });

  it("matches parameter names case-insensitively", () => {
    expect(redactUrl("/i/a?SIG=x&Signature=y")).toBe(`/i/a?SIG=${REDACTED}&Signature=${REDACTED}`);
  });
});
