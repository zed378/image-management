import { describe, expect, it } from "vitest";

import { AppError } from "@image-delivery/errors";

import {
  bucketFromAccept,
  canonicalize,
  isNearMiss,
  type CanonicalizeContext,
} from "./canonicalize";

// docs/IMAGE-DELIVERY-PROTOCOL/03 and 04, rule by rule. The golden vectors
// that pin params_hash across releases are in golden-vectors.test.ts.

const ctx: CanonicalizeContext = {
  acceptBucket: "avif",
  source: { width: 4000, height: 3000, orientation: 0 },
};

const canon = (q: string, over: Partial<CanonicalizeContext> = {}) =>
  canonicalize(q, { ...ctx, ...over });

const failure = (q: string, over: Partial<CanonicalizeContext> = {}) => {
  try {
    canon(q, over);
  } catch (err) {
    if (err instanceof AppError) return { code: err.code, details: err.details };
    throw err;
  }
  throw new Error(`expected ${q} to be rejected`);
};

describe("the reference examples", () => {
  it("canonicalizes IDP/03's example to the documented form", () => {
    expect(canon("w=800&h=600&fit=cover&g=center&q=80&f=auto").canonical).toBe(
      "dpr=1&f=avif&fit=cover&g=center&h=600&q=80&w=800",
    );
  });

  it.each([
    "h=600&q=80&f=auto&fit=cover&w=800&g=center",
    "width=800&height=600&fit=crop&position=center&quality=80&format=auto",
    "w=800&h=600&c=fill&g=center&q=80&auto=format&utm_source=newsletter",
    "w=800&h=600&fit=cover&crop=center&q=80&fm=auto",
    "?w=800&h=600&fit=cover&g=center&q=80&auto=format",
  ])("treats %s as the same transformation (the equivalence guarantee)", (q) => {
    const reference = canon("w=800&h=600&fit=cover&g=center&q=80&f=auto");

    expect(canon(q).canonical).toBe(reference.canonical);
    expect(canon(q).paramsHash).toBe(reference.paramsHash);
  });

  it("reports the tracking parameter as ignored, and keeps it out of the hash", () => {
    const result = canon("w=800&h=600&c=fill&g=center&q=80&auto=format&utm_source=newsletter");

    expect(result.ignored).toEqual(["utm_source"]);
  });
});

describe("parsing", () => {
  it("lets the last duplicate win, across aliases too", () => {
    expect(canon("w=100&w=200").params["w"]).toBe("200");
    expect(canon("w=100&width=300").params["w"]).toBe("300");
  });

  it("percent-decodes", () => {
    expect(canon("g%3D=1&f=%77ebp").params["f"]).toBe("webp");
  });
});

describe("unknown parameters partition three ways (ADR-013)", () => {
  it.each(["Width=400", "widht=400", "quallity=80", "dpr_=2", "WIDTH=4", "hieght=3"])(
    "rejects the near-miss %s, naming it",
    (q) => {
      const f = failure(q);
      expect(f.code).toBe("invalid_transform_param");
      expect(f.details[0]).toMatchObject({ reason: "unknown_parameter" });
    },
  );

  it.each(["v=3", "t=1", "utm_source=x", "fbclid=abc", "gclid=1", "cachebust=9", "ref=home"])(
    "ignores the foreign %s",
    (q) => {
      expect(canon(`w=10&${q}`).ignored).toEqual([q.split("=")[0]]);
    },
  );

  it("rejects foreign parameters too when the project is strict", () => {
    expect(failure("w=10&utm_source=x", { strictParameters: true }).details[0]).toMatchObject({
      field: "utm_source",
      reason: "unknown_parameter",
    });
  });

  it("detects near-misses only where the distance means something", () => {
    expect(isNearMiss("widht")).toBe(true);
    expect(isNearMiss("v")).toBe(false);
    expect(isNearMiss("fitt")).toBe(true);
    expect(isNearMiss("x")).toBe(false);
  });
});

describe("rejections (IDP/03 table)", () => {
  it.each([
    ["w=abc", "w", "type"],
    ["w=0", "w", "out_of_range"],
    ["w=8193", "w", "out_of_range"],
    ["dpr=4", "dpr", "out_of_range"],
    ["dpr=1.25", "dpr", "type"],
    ["fit=stretchy", "fit", "not_allowed"],
    ["f=gif", "f", "not_allowed"],
    ["q=101", "q", "out_of_range"],
    ["g=north", "g", "not_allowed"],
    ["g=1.5,0.5&w=10&fit=cover", "g", "out_of_range"],
    ["bg=notacolor", "bg", "type"],
    ["rot=45", "rot", "not_allowed"],
    ["flip=x", "flip", "not_allowed"],
    ["blur=101", "blur", "out_of_range"],
    ["rect=0,0,5000,10", "rect", "out_of_bounds"],
    ["ar=16-9&w=10", "ar", "type"],
    ["auto=everything", "auto", "not_allowed"],
    ["w=8000&h=8000", "w", "pixel_budget_exceeded"],
    ["w=4000&h=3000&dpr=3", "w", "pixel_budget_exceeded"],
    ["dl=a%0Ab", "dl", "not_allowed"],
  ])("%s -> %s / %s", (q, field, reason) => {
    const f = failure(q);
    expect(f.code).toBe("invalid_transform_param");
    expect(f.details).toEqual([{ field, reason }]);
  });

  it.each(["ar=16:9&w=100&h=100", "ar=16:9"])("rejects %s as over-specified", (q) => {
    expect(failure(q)).toEqual({
      code: "invalid_parameter_combination",
      details: [{ field: "ar", reason: "over_specified" }],
    });
  });
});

describe("the interaction matrix (IDP/04)", () => {
  it("derives the other dimension from ar", () => {
    expect(canon("ar=16:9&w=1600").params).toMatchObject({ w: "1600", h: "900" });
    expect(canon("ar=1:2&h=100").params).toMatchObject({ w: "50", h: "100" });
    expect(canon("ar=16:9&w=1600").params["ar"]).toBeUndefined();
  });

  it("does not resize, and drops dpr/fit/g, without w or h", () => {
    const result = canon("dpr=2&fit=cover&g=top&blur=5");

    expect(result.canonical).toBe("blur=5&f=avif&q=50");
    expect(result.ignored).toEqual(["dpr", "fit", "g"]);
  });

  it("ignores gravity unless fit is cover or contain", () => {
    const result = canon("w=100&fit=inside&g=top");

    expect(result.params["g"]).toBeUndefined();
    expect(result.ignored).toEqual(["g"]);
  });

  it("ignores q for png", () => {
    const result = canon("w=100&f=png&q=90");

    expect(result.canonical).toBe("dpr=1&f=png&fit=scale-down&w=100");
    expect(result.ignored).toEqual(["q"]);
  });

  it("pads fit=contain with bg, transparent unless the format is opaque", () => {
    expect(canon("w=100&h=100&fit=contain&f=webp").params["bg"]).toBe("00000000");
    expect(canon("w=100&h=100&fit=contain&f=jpeg").params["bg"]).toBe("FFFFFF");
    expect(canon("w=100&h=100&fit=contain&bg=red").params["bg"]).toBe("FF0000");
  });

  it("keeps bg for flattening onto jpeg, ignores it otherwise", () => {
    expect(canon("w=100&f=jpeg&bg=white").params["bg"]).toBe("FFFFFF");
    expect(canon("w=100&f=webp&bg=white").ignored).toEqual(["bg"]);
  });

  it("drops no-op effects", () => {
    expect(canon("w=100&blur=0&sharpen=0&rot=0").ignored).toEqual(["blur", "rot", "sharpen"]);
  });
});

describe("defaults and resolution (steps 9-10)", () => {
  it("makes every default explicit: fit=scale-down, dpr=1, f and q resolved", () => {
    expect(canon("w=800").canonical).toBe("dpr=1&f=avif&fit=scale-down&q=50&w=800");
  });

  it("resolves f=auto from the Accept bucket, never hashing the word auto", () => {
    const webp = canon("w=800", { acceptBucket: "webp" });
    const jpeg = canon("w=800", { acceptBucket: "jpeg" });

    expect(webp.format).toBe("webp");
    expect(webp.params["q"]).toBe("75");
    expect(jpeg.params["q"]).toBe("80");
    expect(webp.paramsHash).not.toBe(jpeg.paramsHash);
    expect(webp.canonical).not.toContain("auto");
  });

  it("leaves an explicit format alone whatever the Accept bucket", () => {
    expect(canon("w=800&f=webp", { acceptBucket: "jpeg" }).format).toBe("webp");
  });

  it("resolves rot=auto from the source's EXIF orientation", () => {
    const rotated = { width: 4000, height: 3000, orientation: 90 as const };
    expect(canon("w=100", { source: rotated }).params["rot"]).toBe("90");
    expect(canon("w=100&rot=0", { source: rotated }).params["rot"]).toBeUndefined();
  });

  it("resolves g=auto through the resolver into a concrete rectangle", () => {
    const result = canon("w=100&h=100&fit=cover&g=auto", {
      resolveGravity: () => ({ x: 10, y: 20, w: 300, h: 300 }),
    });

    expect(result.params["g"]).toBe("r:10,20,300,300");
  });

  it("refuses to hash g=auto without a resolver (a programming error, not a 400)", () => {
    expect(() => canon("w=100&h=100&fit=cover&g=auto")).toThrow(/gravity resolver/);
  });

  it("canonicalizes a focal point", () => {
    expect(canon("w=10&h=10&fit=cover&g=0.50,1.0").params["g"]).toBe("0.5,1");
  });
});

describe("snapping (ADR-014)", () => {
  it("snaps up to the ladder when the project enables it", () => {
    expect(canon("w=401", { dimensionLadder: true }).params["w"]).toBe("640");
    expect(canon("w=401", { dimensionLadder: true }).paramsHash).toBe(
      canon("w=420", { dimensionLadder: true }).paramsHash,
    );
  });

  it("leaves dimensions above the top rung, and everything when off", () => {
    expect(canon("w=4000", { dimensionLadder: true }).params["w"]).toBe("4000");
    expect(canon("w=401").params["w"]).toBe("401");
  });
});

describe("delivery and signature parameters", () => {
  it("keeps dl, exp and sig out of the transformation hash", () => {
    const plain = canon("w=100");
    const withDelivery = canon("w=100&dl=photo.jpg&exp=1900000000&sig=abcd");

    expect(withDelivery.paramsHash).toBe(plain.paramsHash);
    expect(withDelivery.delivery).toEqual({ download: "photo.jpg" });
    expect(withDelivery.signature).toEqual({ exp: "1900000000", sig: "abcd" });
  });
});

describe("the Accept bucket (ADR-008)", () => {
  it.each([
    ["image/avif,image/webp,*/*", "avif"],
    ["image/webp,*/*;q=0.8", "webp"],
    ["image/avif;q=0,image/webp", "webp"],
    ["text/html,*/*", "jpeg"],
    [undefined, "jpeg"],
  ] as const)("%s -> %s", (accept, bucket) => {
    expect(bucketFromAccept(accept)).toBe(bucket);
  });
});

describe("edge cases of every step", () => {
  it("treats a bare key, an undecodable key, and an undecodable foreign value as foreign", () => {
    expect(canon("w=10&flag&%E0%A4%A=1&x=%E0%A4%A").ignored).toEqual(["flag"]);
  });

  it("rejects an undecodable value of a known parameter", () => {
    expect(failure("w=%E0%A4%A").details).toEqual([{ field: "w", reason: "type" }]);
  });

  it.each([
    ["ar=0:5&w=10", "ar", "out_of_range"],
    ["ar=1:1000&w=100", "ar", "out_of_range"],
    ["rect=a,b,c,d", "rect", "type"],
    ["rect=0,0,0,5", "rect", "out_of_range"],
    [`dl=${"x".repeat(256)}`, "dl", "out_of_range"],
    ["w=3000&h=3000&dpr=2", "w", "pixel_budget_exceeded"],
    ["h=6000&dpr=2", "h", "pixel_budget_exceeded"],
  ])("%s -> %s / %s", (q, field, reason) => {
    expect(failure(q).details).toEqual([{ field, reason }]);
  });

  it("accepts explicit q=auto, a hex bg, an explicit rotation, sharpen and flip", () => {
    const result = canon("w=100&q=auto&f=jpeg&bg=ff00aa&rot=90&sharpen=10&flip=h");

    expect(result.params).toMatchObject({
      q: "80",
      bg: "FF00AA",
      rot: "90",
      sharpen: "10",
      flip: "h",
    });
  });

  it("resolves g=face and imgix's g=faces through the resolver", () => {
    const seen: string[] = [];
    const resolveGravity = (mode: "auto" | "face") => {
      seen.push(mode);
      return { x: 1, y: 2, w: 3, h: 4 };
    };

    canon("w=10&h=10&fit=cover&g=face", { resolveGravity });
    canon("w=10&h=10&fit=cover&g=faces", { resolveGravity });

    expect(seen).toEqual(["face", "face"]);
  });

  it("snaps a height-only request, and checks the budget from the source aspect", () => {
    expect(canon("h=401", { dimensionLadder: true }).params["h"]).toBe("640");
    expect(canon("h=300").params).toMatchObject({ h: "300" });
  });
});
