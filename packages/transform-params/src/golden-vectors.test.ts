import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalize, type SourceFacts } from "./canonicalize";

// The golden vectors (docs/IMAGE-DELIVERY-PROTOCOL/03 "The equivalence
// guarantee", docs/ENGINEERING/09 suite 2). APPEND-ONLY: every stored object
// key and every CDN cache key derives from these hashes, so a changed
// expected value is a released-contract break that needs an ADR and a
// table-version bump -- never a re-recorded fixture. Add new vectors at the
// end; never edit or remove one.

type Vector = {
  readonly query: string;
  readonly acceptBucket: "avif" | "webp" | "jpeg";
  readonly dimensionLadder?: boolean;
  readonly canonical: string;
  readonly paramsHash: string;
};

const fixture = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../fixtures/golden-vectors.json"), "utf8"),
) as { source: SourceFacts; vectors: Vector[] };

describe("golden vectors", () => {
  it.each(fixture.vectors.map((v) => [`${v.query || "(empty)"} [${v.acceptBucket}]`, v] as const))(
    "%s",
    (_name, v) => {
      const result = canonicalize(v.query, {
        acceptBucket: v.acceptBucket,
        source: fixture.source,
        ...(v.dimensionLadder === true ? { dimensionLadder: true } : {}),
      });

      expect(result.canonical).toBe(v.canonical);
      expect(result.paramsHash).toBe(v.paramsHash);
    },
  );

  it("has no two vectors with the same hash but different canonical forms", () => {
    const byHash = new Map<string, string>();
    for (const v of fixture.vectors) {
      const seen = byHash.get(v.paramsHash);
      if (seen !== undefined) expect(seen).toBe(v.canonical);
      byHash.set(v.paramsHash, v.canonical);
    }
  });
});
