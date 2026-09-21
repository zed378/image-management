import { validateObjectKey } from "./keys";

// The object key scheme (docs/STORAGE/04-OBJECT-NAMING.md, ADR-022 point 8).
//
//   originals:   {tenant}/{project}/originals/{asset}/{version}.{ext}
//   derivatives: {tenant}/{project}/derivatives/{asset}/{version}/{params_hash}.{ext}
//
// Every segment is a ULID or a params_hash the platform generated -- never
// caller input (SEC-UPL-06) -- and every key starts with the tenant and
// project, so a prefix is an isolation boundary (SEC-TEN-05). The key is
// stored on the row that owns the object; this function decides it once,
// at write time.

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const PARAMS_HASH = /^[0-9a-f]{16,128}$/;

/** File extension per stored media type. The extension is cosmetic; Content-Type is stored separately. */
export const EXTENSION_BY_MEDIA_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/tiff": "tif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const EXTENSION_BY_FORMAT = { avif: "avif", webp: "webp", jpeg: "jpg", png: "png" } as const;

const ulid = (name: string, value: string): string => {
  if (!ULID.test(value)) throw new Error(`object key: ${name} must be a ULID`);
  return value;
};

export type OriginalKeyParts = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly mediaType: string;
};

export const originalObjectKey = (p: OriginalKeyParts): string => {
  const ext = EXTENSION_BY_MEDIA_TYPE[p.mediaType];
  if (!ext) throw new Error(`object key: no extension for media type ${p.mediaType}`);
  return validateObjectKey(
    [
      ulid("tenantId", p.tenantId),
      ulid("projectId", p.projectId),
      "originals",
      ulid("assetId", p.assetId),
      `${ulid("versionId", p.versionId)}.${ext}`,
    ].join("/"),
  );
};

export type DerivativeKeyParts = Omit<OriginalKeyParts, "mediaType"> & {
  readonly paramsHash: string;
  readonly format: keyof typeof EXTENSION_BY_FORMAT;
};

export const derivativeObjectKey = (p: DerivativeKeyParts): string => {
  if (!PARAMS_HASH.test(p.paramsHash))
    throw new Error("object key: paramsHash must be lower-case hex");
  return validateObjectKey(
    [
      ulid("tenantId", p.tenantId),
      ulid("projectId", p.projectId),
      "derivatives",
      ulid("assetId", p.assetId),
      ulid("versionId", p.versionId),
      `${p.paramsHash}.${EXTENSION_BY_FORMAT[p.format]}`,
    ].join("/"),
  );
};

/** Every object of one asset version's derivatives, for invalidation (docs/IMAGE-DELIVERY-PROTOCOL/17). */
export const derivativePrefix = (p: Omit<DerivativeKeyParts, "paramsHash" | "format">): string =>
  `${ulid("tenantId", p.tenantId)}/${ulid("projectId", p.projectId)}/derivatives/${ulid("assetId", p.assetId)}/${ulid("versionId", p.versionId)}/`;
