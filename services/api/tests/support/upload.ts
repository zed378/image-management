import sharp from "sharp";

// Multipart upload bodies for tests: a small real image by default.

export const smallPng = (width = 32, height = 24): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: "#cc3366" } })
    .png()
    .toBuffer();

export const multipartBody = (
  file: Buffer,
  options: {
    readonly filename?: string;
    readonly contentType?: string;
    readonly fields?: Readonly<Record<string, string>>;
  } = {},
) => {
  const boundary = `----test${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(options.fields ?? {})) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${options.filename ?? "image.png"}"\r\n` +
        `Content-Type: ${options.contentType ?? "image/png"}\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return {
    payload: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
};
