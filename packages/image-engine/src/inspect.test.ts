import { crc32 } from "node:zlib";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { AppError } from "@image-delivery/errors";

import { inspectImage, sniffMediaType, UPLOAD_MAX_BYTES } from "./inspect";

// P2-02 DoD: a spoofed type is rejected (the type comes from the bytes), and
// an image declaring absurd dimensions is rejected from its header alone,
// before any decode.

const solid = (format: "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff", w = 64, h = 48) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#3366cc" } })
    .toFormat(format)
    .toBuffer();

const codeOf = async (buf: Buffer): Promise<string> => {
  try {
    await inspectImage(buf);
  } catch (err) {
    if (err instanceof AppError) return err.code;
    throw err;
  }
  throw new Error("expected a rejection");
};

/** A valid PNG header declaring width x height, with no pixel data to speak of. */
const pngDeclaring = (width: number, height: number): Buffer => {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

describe("inspectImage", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
    ["gif", "image/gif"],
    ["tiff", "image/tiff"],
  ] as const)("accepts %s and reports its facts", async (format, mediaType) => {
    const buf = await solid(format);

    const facts = await inspectImage(buf);

    expect(facts).toMatchObject({
      mediaType,
      width: 64,
      height: 48,
      byteSize: buf.length,
      pages: 1,
    });
    expect(facts.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("applies EXIF orientation to the reported dimensions", async () => {
    const rotated = await sharp(await solid("jpeg", 64, 48))
      .withMetadata({ orientation: 6 })
      .toBuffer();

    expect(await inspectImage(rotated)).toMatchObject({ width: 48, height: 64, orientation: 90 });
  });

  it("rejects an image declaring absurd dimensions from its header, without decoding", async () => {
    const bomb = pngDeclaring(100_000, 100_000);
    const started = performance.now();

    expect(await codeOf(bomb)).toBe("image_dimensions_exceeded");
    // Decoding 10^10 pixels would take minutes and tens of gigabytes; the
    // header check answers in milliseconds.
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(bomb.length).toBeLessThan(100);
  });

  it("rejects dimensions over the pixel budget even when each side is allowed", async () => {
    expect(await codeOf(pngDeclaring(16_000, 16_000))).toBe("image_dimensions_exceeded");
  });

  it.each([
    [
      "an SVG",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ],
    ["HTML", Buffer.from("<!doctype html><html><body>hi</body></html>")],
    ["a zip", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])],
    ["a PDF", Buffer.from("%PDF-1.7\n")],
  ])("rejects %s whatever it claims to be", async (_name, buf) => {
    expect(await codeOf(buf)).toBe("unsupported_media_type");
  });

  it("identifies the type from the bytes, so a renamed file is what it really is", async () => {
    // A PNG uploaded as "photo.jpg" with Content-Type image/jpeg is a PNG.
    expect(sniffMediaType(await solid("png"))).toBe("image/png");
  });

  it("rejects a truncated file whose signature looks right", async () => {
    const jpeg = await solid("jpeg");

    expect(await codeOf(jpeg.subarray(0, 20))).toBe("image_decode_failed");
  });

  it("rejects an empty and an oversized file", async () => {
    expect(await codeOf(Buffer.alloc(0))).toBe("image_decode_failed");
    expect(await codeOf(Buffer.alloc(UPLOAD_MAX_BYTES + 1))).toBe("upload_too_large");
  });
});
