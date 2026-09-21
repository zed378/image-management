// One-shot `hash`, not createHash: this is a content checksum, and createHash
// is reserved to packages/transform-params by lint (ADR-004).
import { hash } from "node:crypto";

import sharp, { type Metadata } from "sharp";

import { AppError } from "@image-delivery/errors";

// Upload validation (docs/IMAGE-PROCESSING/02, docs/SECURITY/13-14,
// SEC-UPL-01..03, P2-02). The order is the defence:
//
//   1. size        -- bounded before anything else looks at the bytes
//   2. magic bytes -- the type comes from the content, never from the
//                     filename or the declared Content-Type
//   3. header      -- dimensions read from the header only (libvips reads
//                     metadata without decoding pixels); a decompression
//                     bomb declaring 100000 x 100000 is refused here,
//                     before a single pixel is allocated
//   4. agreement   -- the decoder must agree with the sniffed type
//
// Nothing here decodes the image. Full decoding happens in the worker,
// under its own timeout and memory ceiling (SEC-UPL-05).

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const UPLOAD_MAX_DIMENSION_PX = 16_384;
export const UPLOAD_MAX_PIXELS = 50_000_000;
/** Frames in an animated GIF/WebP. */
export const UPLOAD_MAX_PAGES = 100;

/** The input formats v1 accepts. SVG is refused outright (SEC-UPL-03). */
export const INPUT_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
] as const;
export type InputMediaType = (typeof INPUT_MEDIA_TYPES)[number];

export type ImageFacts = {
  readonly mediaType: InputMediaType;
  readonly byteSize: number;
  /** As displayed: after the EXIF orientation is applied. */
  readonly width: number;
  readonly height: number;
  /** The rotation EXIF orientation implies (rot=auto). */
  readonly orientation: 0 | 90 | 180 | 270;
  readonly hasAlpha: boolean;
  readonly pages: number;
  readonly checksumSha256: string;
};

const startsWith = (buf: Buffer, bytes: readonly number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.toString("latin1", start, end);

/** The media type the bytes declare, or null. Never looks at a filename. */
export const sniffMediaType = (buf: Buffer): InputMediaType | null => {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "image/webp";
  if (ascii(buf, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(buf, 8, 12)))
    return "image/avif";
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "image/tiff";
  }
  return null;
};

const SHARP_FORMAT: Readonly<Record<InputMediaType, string>> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "heif",
  "image/gif": "gif",
  "image/tiff": "tiff",
};

const ORIENTATION_ANGLE: Readonly<Record<number, 0 | 90 | 180 | 270>> = {
  1: 0,
  2: 0,
  3: 180,
  4: 180,
  5: 90,
  6: 90,
  7: 270,
  8: 270,
};

export const inspectImage = async (buf: Buffer): Promise<ImageFacts> => {
  // 1. Size.
  if (buf.length === 0)
    throw new AppError("image_decode_failed", { message: "The file is empty." });
  if (buf.length > UPLOAD_MAX_BYTES) throw new AppError("upload_too_large");

  // 2. Magic bytes.
  const mediaType = sniffMediaType(buf);
  if (!mediaType) throw new AppError("unsupported_media_type");

  // 3. Header only. `limitInputPixels: false` because the limits below are
  //    ours, explicit, and checked on the header values themselves.
  let meta: Metadata;
  try {
    meta = await sharp(buf, { limitInputPixels: false, pages: -1 }).metadata();
  } catch (err) {
    throw new AppError("image_decode_failed", { cause: err });
  }
  const rawWidth = meta.width;
  const rawHeight = meta.pageHeight ?? meta.height;
  if (!rawWidth || !rawHeight) throw new AppError("image_decode_failed");
  if (
    rawWidth > UPLOAD_MAX_DIMENSION_PX ||
    rawHeight > UPLOAD_MAX_DIMENSION_PX ||
    rawWidth * rawHeight > UPLOAD_MAX_PIXELS
  ) {
    throw new AppError("image_dimensions_exceeded", {
      details: [{ field: "file", reason: "dimensions_exceeded" }],
    });
  }
  const pages = meta.pages ?? 1;
  if (pages > UPLOAD_MAX_PAGES) {
    throw new AppError("image_dimensions_exceeded", {
      details: [{ field: "file", reason: "too_many_frames" }],
    });
  }

  // 4. The decoder must agree with the sniffed type: a PNG signature on a
  //    file libvips reads as something else is a polyglot, refused.
  if (meta.format !== SHARP_FORMAT[mediaType]) throw new AppError("unsupported_media_type");

  const orientation = ORIENTATION_ANGLE[meta.orientation ?? 1] ?? 0;
  const swapped = orientation === 90 || orientation === 270;
  return {
    mediaType,
    byteSize: buf.length,
    width: swapped ? rawHeight : rawWidth,
    height: swapped ? rawWidth : rawHeight,
    orientation,
    hasAlpha: meta.hasAlpha,
    pages,
    checksumSha256: hash("sha256", buf, "hex"),
  };
};
