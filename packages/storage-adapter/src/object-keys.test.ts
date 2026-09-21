import { describe, expect, it } from "vitest";

import { derivativeObjectKey, derivativePrefix, originalObjectKey } from "./object-keys";

const T = "01HZZZZZZZZZZZZZZZZZZZZZT1";
const P = "01HZZZZZZZZZZZZZZZZZZZZZP1";
const A = "01HZZZZZZZZZZZZZZZZZZZZZA1";
const V = "01HZZZZZZZZZZZZZZZZZZZZZV1";

describe("object keys (docs/STORAGE/04)", () => {
  it("names an original by tenant, project, asset and version", () => {
    expect(
      originalObjectKey({
        tenantId: T,
        projectId: P,
        assetId: A,
        versionId: V,
        mediaType: "image/jpeg",
      }),
    ).toBe(`${T}/${P}/originals/${A}/${V}.jpg`);
  });

  it("names a derivative by version and params_hash, under a per-version prefix", () => {
    const key = derivativeObjectKey({
      tenantId: T,
      projectId: P,
      assetId: A,
      versionId: V,
      paramsHash: "8307391ea584357bf6f8f2f6834fda8e",
      format: "avif",
    });

    expect(key).toBe(`${T}/${P}/derivatives/${A}/${V}/8307391ea584357bf6f8f2f6834fda8e.avif`);
    expect(
      key.startsWith(derivativePrefix({ tenantId: T, projectId: P, assetId: A, versionId: V })),
    ).toBe(true);
  });

  it("refuses anything that is not a platform-generated id (SEC-UPL-06)", () => {
    const base = { tenantId: T, projectId: P, assetId: A, versionId: V, mediaType: "image/png" };

    expect(() => originalObjectKey({ ...base, assetId: "../../etc/passwd" })).toThrow(/ULID/);
    expect(() => originalObjectKey({ ...base, versionId: "photo.jpg" })).toThrow(/ULID/);
    expect(() => originalObjectKey({ ...base, mediaType: "text/html" })).toThrow(/media type/);
    expect(() => derivativeObjectKey({ ...base, paramsHash: "../x", format: "webp" })).toThrow(
      /paramsHash/,
    );
  });

  it("always begins with the tenant, so a prefix is an isolation boundary (SEC-TEN-05)", () => {
    expect(
      originalObjectKey({
        tenantId: T,
        projectId: P,
        assetId: A,
        versionId: V,
        mediaType: "image/webp",
      }).split("/")[0],
    ).toBe(T);
  });
});
