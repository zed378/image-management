import { createHash } from "node:crypto";

import { AppError, type ErrorDetail } from "@image-delivery/errors";

import { CSS_NAMED_COLORS } from "./colors";
import {
  AR_PART_MAX,
  CANONICAL_FORM_VERSION,
  DIMENSION_LADDER,
  DOWNLOAD_NAME_MAX,
  DPR_MAX,
  DPR_MIN,
  EFFECT_MAX,
  PARAMS_HASH_HEX_LENGTH,
  QUALITY_TABLE,
  TABLES_VERSION,
  TRANSFORM_MAX_DIMENSION_PX,
  TRANSFORM_MAX_PIXELS,
  type AcceptBucket,
  type OutputFormat,
} from "./constants";
import {
  CANONICAL_PARAMS,
  COMPATIBILITY_KEYS,
  FIT_VALUE_ALIASES,
  FIT_VALUES,
  GRAVITY_KEYWORDS,
  KNOWN_NAMES,
  NAME_ALIASES,
  type CanonicalParam,
  type Fit,
} from "./vocabulary";

// The canonicalization algorithm of docs/IMAGE-DELIVERY-PROTOCOL/03, steps
// 1-14, in that order -- the order is part of the contract. Pure and total:
// a raw query plus its context gives one canonical form, or an AppError.
// The single implementation for the CDN cache key, the object key and the
// derivative identity (ADR-004, ADR-009); never reimplemented elsewhere.

export type SourceFacts = {
  readonly width: number;
  readonly height: number;
  /** The rotation EXIF orientation implies, applied by rot=auto. */
  readonly orientation: 0 | 90 | 180 | 270;
};

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type CanonicalizeContext = {
  /** The Accept bucket (bucketFromAccept); what f=auto resolves to. */
  readonly acceptBucket: AcceptBucket;
  readonly source: SourceFacts;
  /** Project setting (ADR-014). */
  readonly dimensionLadder?: boolean;
  /** Project setting (ADR-013): reject foreign parameters too. */
  readonly strictParameters?: boolean;
  /** Resolves g=auto / g=face to a rectangle of the source (P3-04). */
  readonly resolveGravity?: (mode: "auto" | "face", source: SourceFacts) => Rect;
};

export type Canonical = {
  /** The canonical transformation, keys in ASCII order. */
  readonly params: Readonly<Record<string, string>>;
  /** `k=v&...` -- the input to the hash. */
  readonly canonical: string;
  readonly paramsHash: string;
  /** Resolved output format. */
  readonly format: OutputFormat;
  /** Parameters dropped: foreign, and no-ops/inapplicable ones (X-Image-Ignored-Params). */
  readonly ignored: readonly string[];
  /** Delivery parameters: change headers, not bytes, so never in the hash. */
  readonly delivery: { readonly download?: string };
  readonly signature: { readonly exp?: string; readonly sig?: string };
};

// ==========================================
// HELPERS
// ==========================================

const reject = (field: string, reason: string): never => {
  throw new AppError("invalid_transform_param", { details: [{ field, reason }] });
};

const overSpecified = (field: string): never => {
  throw new AppError("invalid_parameter_combination", {
    details: [{ field, reason: "over_specified" }],
  });
};

const levenshtein = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j] ?? 0;
      row[j] = Math.min(
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return row[b.length] ?? 0;
};

/**
 * Near-miss: a known name in another case, or a small edit away from a known
 * name long enough for the distance to mean something. Short names (w, h,
 * q, f, g, ...) only match by case, else every short foreign parameter
 * (`v`, `t`) would be rejected. Tuned per IDP/03's open question: distance
 * <= 2 for names of 5+ characters, <= 1 for 3-4 characters.
 */
export const isNearMiss = (key: string): boolean => {
  const lower = key.toLowerCase();
  return KNOWN_NAMES.some((known) => {
    if (lower === known) return key !== known;
    const allowed = known.length >= 5 ? 2 : known.length >= 3 ? 1 : 0;
    return allowed > 0 && levenshtein(lower, known) <= allowed;
  });
};

const decode = (raw: string): string | null => {
  try {
    return decodeURIComponent(raw.replaceAll("+", " "));
  } catch {
    return null;
  }
};

const integer = (field: string, value: string, min: number, max: number): number => {
  if (!/^\d{1,9}$/.test(value)) return reject(field, "type");
  const n = Number(value);
  if (n < min || n > max) return reject(field, "out_of_range");
  return n;
};

const formatDecimal = (n: number): string => String(Number(n.toFixed(4)));

// ==========================================
// THE ALGORITHM
// ==========================================

export const canonicalize = (query: string, ctx: CanonicalizeContext): Canonical => {
  // 1. PARSE -- last occurrence wins, in order of appearance.
  const pairs: [string, string][] = [];
  for (const part of query.replace(/^\?/, "").split("&")) {
    if (part === "") continue;
    const eq = part.indexOf("=");
    const rawKey = eq < 0 ? part : part.slice(0, eq);
    const rawValue = eq < 0 ? "" : part.slice(eq + 1);
    const key = decode(rawKey);
    const value = decode(rawValue);
    if (key === null) continue; // an undecodable key cannot be ours: foreign
    if (value === null) {
      if (KNOWN_NAMES.includes(key)) reject(key, "type");
      continue;
    }
    pairs.push([key, value]);
  }

  // 2-5. PARTITION, REJECT, DISCARD, ALIAS.
  const ignored = new Set<string>();
  const raw = new Map<CanonicalParam, { value: string; from: string }>();
  for (const [key, value] of pairs) {
    const compatibility = COMPATIBILITY_KEYS[key];
    if (compatibility) {
      const mapped = compatibility[value];
      if (!mapped) reject(key, "not_allowed");
      for (const [name, v] of mapped ?? []) raw.set(name, { value: v, from: key });
      continue;
    }
    const canonical = (CANONICAL_PARAMS as readonly string[]).includes(key)
      ? (key as CanonicalParam)
      : NAME_ALIASES[key];
    if (canonical) {
      raw.set(canonical, { value, from: key });
      continue;
    }
    if (isNearMiss(key) || ctx.strictParameters === true) reject(key, "unknown_parameter");
    ignored.add(key);
  }

  const take = (name: CanonicalParam) => raw.get(name);

  // 6-7. COERCE, VALIDATE.
  const w = take("w") && integer("w", take("w")?.value ?? "", 1, TRANSFORM_MAX_DIMENSION_PX);
  const h = take("h") && integer("h", take("h")?.value ?? "", 1, TRANSFORM_MAX_DIMENSION_PX);

  let ar: [number, number] | undefined;
  const arRaw = take("ar")?.value;
  if (arRaw !== undefined) {
    const m = /^(\d{1,4}):(\d{1,4})$/.exec(arRaw);
    if (!m) reject("ar", "type");
    const aw = Number(m?.[1]);
    const ah = Number(m?.[2]);
    if (aw < 1 || ah < 1 || aw > AR_PART_MAX || ah > AR_PART_MAX) reject("ar", "out_of_range");
    ar = [aw, ah];
  }

  let dpr: number | undefined;
  const dprRaw = take("dpr")?.value;
  if (dprRaw !== undefined) {
    if (!/^\d(\.\d)?$/.test(dprRaw)) reject("dpr", "type");
    dpr = Number(dprRaw);
    if (dpr < DPR_MIN || dpr > DPR_MAX) reject("dpr", "out_of_range");
  }

  let fit: Fit | undefined;
  const fitRaw = take("fit")?.value;
  if (fitRaw !== undefined) {
    const value = FIT_VALUE_ALIASES[fitRaw] ?? fitRaw;
    if (!(FIT_VALUES as readonly string[]).includes(value)) reject("fit", "not_allowed");
    fit = value as Fit;
  }

  let gravity: string | undefined;
  let gravityMode: "auto" | "face" | undefined;
  const gRaw = take("g")?.value;
  if (gRaw !== undefined) {
    const point = /^(0(?:\.\d{1,4})?|1(?:\.0{1,4})?),(0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/.exec(gRaw);
    if (point) gravity = `${formatDecimal(Number(point[1]))},${formatDecimal(Number(point[2]))}`;
    else if (gRaw === "auto" || gRaw === "face" || gRaw === "faces")
      gravityMode = gRaw === "auto" ? "auto" : "face";
    else if ((GRAVITY_KEYWORDS as readonly string[]).includes(gRaw)) gravity = gRaw;
    else if (/^[\d.,]+$/.test(gRaw)) reject("g", "out_of_range");
    else reject("g", "not_allowed");
  }

  let rect: Rect | undefined;
  const rectRaw = take("rect")?.value;
  if (rectRaw !== undefined) {
    const m = /^(\d{1,5}),(\d{1,5}),(\d{1,5}),(\d{1,5})$/.exec(rectRaw);
    if (!m) reject("rect", "type");
    const [x, y, rw, rh] = [m?.[1], m?.[2], m?.[3], m?.[4]].map(Number) as [
      number,
      number,
      number,
      number,
    ];
    if (rw < 1 || rh < 1) reject("rect", "out_of_range");
    if (x + rw > ctx.source.width || y + rh > ctx.source.height) reject("rect", "out_of_bounds");
    rect = { x, y, w: rw, h: rh };
  }

  let format: OutputFormat | "auto" = "auto";
  const fRaw = take("f")?.value;
  if (fRaw !== undefined) {
    if (!["auto", "avif", "webp", "jpeg", "png"].includes(fRaw)) reject("f", "not_allowed");
    format = fRaw as OutputFormat | "auto";
  }

  let quality: number | "auto" = "auto";
  const qRaw = take("q")?.value;
  if (qRaw !== undefined) quality = qRaw === "auto" ? "auto" : integer("q", qRaw, 1, 100);

  let bg: string | undefined;
  const bgRaw = take("bg")?.value;
  if (bgRaw !== undefined) {
    const named = CSS_NAMED_COLORS[bgRaw.toLowerCase()];
    if (named) bg = named;
    else if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(bgRaw)) bg = bgRaw.toUpperCase();
    else reject("bg", "type");
  }

  const blur = take("blur") ? integer("blur", take("blur")?.value ?? "", 0, EFFECT_MAX) : 0;
  const sharpen = take("sharpen")
    ? integer("sharpen", take("sharpen")?.value ?? "", 0, EFFECT_MAX)
    : 0;

  let rot: number | "auto" = "auto";
  const rotRaw = take("rot")?.value;
  if (rotRaw !== undefined) {
    if (!["0", "90", "180", "270", "auto"].includes(rotRaw)) reject("rot", "not_allowed");
    rot = rotRaw === "auto" ? "auto" : Number(rotRaw);
  }

  const flipRaw = take("flip")?.value;
  if (flipRaw !== undefined && !["h", "v", "hv"].includes(flipRaw)) reject("flip", "not_allowed");

  const dlRaw = take("dl")?.value;
  if (dlRaw !== undefined) {
    if (dlRaw.length < 1 || dlRaw.length > DOWNLOAD_NAME_MAX) reject("dl", "out_of_range");
    // A newline or control character in a header value is header injection.
    if (/[\u0000-\u001f\u007f]/u.test(dlRaw)) reject("dl", "not_allowed");
  }

  // 8. COMBINE.
  let width = w;
  let height = h;
  if (ar) {
    if (width !== undefined && height !== undefined) overSpecified("ar");
    if (width === undefined && height === undefined) overSpecified("ar");
    if (width !== undefined) height = Math.max(1, Math.round((width * ar[1]) / ar[0]));
    else if (height !== undefined) width = Math.max(1, Math.round((height * ar[0]) / ar[1]));
    if ((width ?? 0) > TRANSFORM_MAX_DIMENSION_PX || (height ?? 0) > TRANSFORM_MAX_DIMENSION_PX) {
      reject("ar", "out_of_range");
    }
  }
  const resizing = width !== undefined || height !== undefined;
  const dropIfGiven = (name: CanonicalParam) => {
    const given = take(name);
    if (given) ignored.add(given.from);
  };
  if (!resizing) {
    // No resize: dpr, fit and gravity have nothing to act on.
    dropIfGiven("dpr");
    dropIfGiven("fit");
    dropIfGiven("g");
  }

  // 9-10. RESOLVE and DEFAULT.
  const resolvedFormat: OutputFormat = format === "auto" ? ctx.acceptBucket : format;
  const params: Record<string, string> = {};
  params["f"] = resolvedFormat;

  if (resolvedFormat === "png") {
    if (take("q")) ignored.add(take("q")?.from ?? "q");
  } else {
    params["q"] = String(quality === "auto" ? QUALITY_TABLE[resolvedFormat] : quality);
  }

  const effectiveFit: Fit = fit ?? "scale-down";
  if (resizing) {
    params["fit"] = effectiveFit;
    params["dpr"] = formatDecimal(dpr ?? 1);
    if (effectiveFit === "cover" || effectiveFit === "contain") {
      if (gravityMode) {
        if (!ctx.resolveGravity) {
          throw new Error(`canonicalize: g=${gravityMode} needs a gravity resolver (P3-04)`);
        }
        const r = ctx.resolveGravity(gravityMode, ctx.source);
        params["g"] = `r:${r.x},${r.y},${r.w},${r.h}`;
      } else {
        params["g"] = gravity ?? "center";
      }
    } else if (take("g")) {
      ignored.add(take("g")?.from ?? "g");
    }
  }

  const resolvedRot = rot === "auto" ? ctx.source.orientation : rot;
  if (resolvedRot !== 0) params["rot"] = String(resolvedRot);
  else if (rotRaw !== undefined && rotRaw !== "auto") ignored.add(take("rot")?.from ?? "rot");

  if (blur > 0) params["blur"] = String(blur);
  else if (take("blur")) ignored.add(take("blur")?.from ?? "blur");
  if (sharpen > 0) params["sharpen"] = String(sharpen);
  else if (take("sharpen")) ignored.add(take("sharpen")?.from ?? "sharpen");
  if (flipRaw !== undefined) params["flip"] = flipRaw;
  if (rect) params["rect"] = `${rect.x},${rect.y},${rect.w},${rect.h}`;

  // bg: padding (fit=contain) or flattening onto an opaque format.
  const padding = resizing && effectiveFit === "contain";
  const flattening = resolvedFormat === "jpeg";
  if (padding) params["bg"] = bg ?? (resolvedFormat === "jpeg" ? "FFFFFF" : "00000000");
  else if (bg !== undefined && flattening) params["bg"] = bg.slice(0, 6);
  else if (bg !== undefined) ignored.add(take("bg")?.from ?? "bg");

  // 11. SNAP (ADR-014): up to the nearest rung; above the top rung, unchanged.
  const snap = (n: number) => DIMENSION_LADDER.find((rung) => rung >= n) ?? n;
  if (ctx.dimensionLadder === true) {
    if (width !== undefined) width = snap(width);
    if (height !== undefined) height = snap(height);
  }
  if (width !== undefined) params["w"] = String(width);
  if (height !== undefined) params["h"] = String(height);

  // 12. CLAMP-CHECK: the effective pixel budget after dpr and snapping.
  if (resizing) {
    const base = rect ?? { w: ctx.source.width, h: ctx.source.height };
    const outW = width ?? Math.round(((height ?? 0) * base.w) / base.h);
    const outH = height ?? Math.round(((width ?? 0) * base.h) / base.w);
    const factor = (dpr ?? 1) ** 2;
    if (outW * outH * factor > TRANSFORM_MAX_PIXELS) {
      throw new AppError("invalid_transform_param", {
        details: [{ field: width !== undefined ? "w" : "h", reason: "pixel_budget_exceeded" }],
      });
    }
  }

  // 13-14. ORDER, SERIALIZE.
  const keys = Object.keys(params).sort();
  const canonical = keys.map((k) => `${k}=${params[k] ?? ""}`).join("&");
  const exp = take("exp")?.value;
  const sig = take("sig")?.value;

  return {
    params: Object.fromEntries(keys.map((k) => [k, params[k] ?? ""])),
    canonical,
    paramsHash: computeParamsHash(canonical),
    format: resolvedFormat,
    ignored: [...ignored].sort(),
    delivery: dlRaw !== undefined ? { download: dlRaw } : {},
    signature: {
      ...(exp !== undefined ? { exp } : {}),
      ...(sig !== undefined ? { sig } : {}),
    },
  };
};

/**
 * params_hash (ADR-004, ADR-023): the first 128 bits, hex, of
 * SHA-256("idp1|<table versions>|<canonical form>"). The table versions make
 * a change to any versioned table a change of identity (ADR-014).
 */
export const computeParamsHash = (canonical: string): string =>
  createHash("sha256")
    .update(`${CANONICAL_FORM_VERSION}|${TABLES_VERSION}|${canonical}`)
    .digest("hex")
    .slice(0, PARAMS_HASH_HEX_LENGTH);

/** RFC 9110 Accept -> one of three buckets, ADR-008's priority order. */
export const bucketFromAccept = (accept: string | undefined): AcceptBucket => {
  const types = (accept ?? "")
    .toLowerCase()
    .split(",")
    .map((part) => part.trim().split(";"))
    .filter(([, ...p]) => !p.some((x) => /^\s*q=0(\.0*)?\s*$/.test(x)))
    .map(([type]) => type?.trim());
  if (types.includes("image/avif")) return "avif";
  if (types.includes("image/webp")) return "webp";
  return "jpeg";
};

export type { ErrorDetail };
