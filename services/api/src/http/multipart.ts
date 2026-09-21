import multipart from "@fastify/multipart";

import { AppError } from "@image-delivery/errors";
import { UPLOAD_MAX_BYTES } from "@image-delivery/image-engine";

import type { FastifyInstance, FastifyRequest } from "fastify";

// multipart/form-data for uploads (docs/API/11, P2-02). Limits are set
// explicitly, never left to the plugin's defaults: one file, a handful of
// short text fields, and the file bounded by UPLOAD_MAX_BYTES while it
// streams -- an oversized upload is cut off, not buffered and then refused.

export const MULTIPART_MAX_FIELDS = 10;
export const MULTIPART_MAX_FIELD_BYTES = 8 * 1024;

export const registerMultipart = async (app: FastifyInstance): Promise<void> => {
  await app.register(multipart, {
    limits: {
      fileSize: UPLOAD_MAX_BYTES,
      files: 1,
      fields: MULTIPART_MAX_FIELDS,
      fieldSize: MULTIPART_MAX_FIELD_BYTES,
      parts: MULTIPART_MAX_FIELDS + 1,
      headerPairs: 100,
    },
    throwFileSizeLimit: true,
  });
};

export type UploadForm = {
  readonly file: Buffer;
  readonly filename: string | undefined;
  readonly fields: Readonly<Record<string, string>>;
};

/** Read the one file (field `file`) and the text fields of an upload form. */
export const readUploadForm = async (request: FastifyRequest): Promise<UploadForm> => {
  if (!request.isMultipart()) throw new AppError("unsupported_media_type");
  let file: Buffer | undefined;
  let filename: string | undefined;
  const fields: Record<string, string> = {};
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (part.fieldname !== "file") {
        throw new AppError("validation_failed", {
          details: [{ field: part.fieldname, reason: "unexpected_file" }],
        });
      }
      file = await part.toBuffer();
      filename = part.filename;
    } else if (typeof part.value === "string") {
      fields[part.fieldname] = part.value;
    }
  }
  if (!file) {
    throw new AppError("validation_failed", { details: [{ field: "file", reason: "required" }] });
  }
  return { file, filename, fields };
};
