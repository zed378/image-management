// The parameter vocabulary as data (docs/IMAGE-DELIVERY-PROTOCOL/04): every
// canonical name, every alias, and every dialect's value mapping. Adding a
// provider dialect is a row here, never a code path.

export const CANONICAL_PARAMS = [
  "w",
  "h",
  "ar",
  "dpr",
  "fit",
  "g",
  "rect",
  "f",
  "q",
  "bg",
  "blur",
  "sharpen",
  "rot",
  "flip",
  "dl",
  "exp",
  "sig",
] as const;

export type CanonicalParam = (typeof CANONICAL_PARAMS)[number];

/** Name aliases -> canonical name. */
export const NAME_ALIASES: Readonly<Record<string, CanonicalParam>> = {
  width: "w",
  height: "h",
  aspect: "ar",
  ratio: "ar",
  gravity: "g",
  position: "g",
  focus: "g",
  fo: "g",
  crop: "g",
  format: "f",
  fm: "f",
  quality: "q",
  background: "bg",
  bl: "blur",
  sharp: "sharpen",
  rotate: "rot",
  download: "dl",
  s: "sig",
};

/** `fit` value aliases (imgix / Cloudflare vocabulary) -> CSS object-fit value. */
export const FIT_VALUE_ALIASES: Readonly<Record<string, string>> = {
  max: "scale-down",
  crop: "cover",
  pad: "contain",
  squeeze: "fill",
  scale: "fill",
  clip: "inside",
  min: "outside",
};

/**
 * Compatibility keys whose *value* decides the canonical parameter(s):
 * Cloudinary `c=`, imgix `auto=`. Resolved to canonical pairs.
 */
export const COMPATIBILITY_KEYS: Readonly<
  Record<string, Readonly<Record<string, readonly (readonly [CanonicalParam, string])[]>>>
> = {
  c: {
    fill: [["fit", "cover"]],
    fit: [["fit", "inside"]],
    scale: [["fit", "fill"]],
    pad: [["fit", "contain"]],
  },
  auto: {
    format: [["f", "auto"]],
    compress: [["q", "auto"]],
    "format,compress": [
      ["f", "auto"],
      ["q", "auto"],
    ],
    "compress,format": [
      ["f", "auto"],
      ["q", "auto"],
    ],
  },
};

export const KNOWN_NAMES: readonly string[] = [
  ...CANONICAL_PARAMS,
  ...Object.keys(NAME_ALIASES),
  ...Object.keys(COMPATIBILITY_KEYS),
];

export const FIT_VALUES = [
  "scale-down",
  "cover",
  "contain",
  "fill",
  "inside",
  "outside",
  "none",
] as const;
export type Fit = (typeof FIT_VALUES)[number];

export const GRAVITY_KEYWORDS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
