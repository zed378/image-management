import { z } from "zod";

import { ULID_PATTERN } from "@image-delivery/schema";
import { PERMISSIONS } from "@image-delivery/tenancy";

import {
  API_KEY_ENVIRONMENTS,
  MAX_API_KEY_NAME_LENGTH,
  MAX_PERMISSIONS_PER_KEY,
  MAX_PROJECTS_PER_KEY,
  MAX_ROTATION_OVERLAP_SECONDS,
} from "./api-key.constants";

const ulid = z.string().regex(ULID_PATTERN);

/**
 * Exactly one of `all_projects: true` or a non-empty `project_ids`: a key's
 * project coverage is always stated, never implied (docs/DATABASE/13).
 */
export const createApiKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_API_KEY_NAME_LENGTH),
    environment: z.enum(API_KEY_ENVIRONMENTS),
    permissions: z
      .array(z.enum(PERMISSIONS))
      .min(1)
      .max(MAX_PERMISSIONS_PER_KEY)
      .transform((p) => [...new Set(p)].sort()),
    all_projects: z.boolean().default(false),
    project_ids: z
      .array(ulid)
      .max(MAX_PROJECTS_PER_KEY)
      .default([])
      .transform((p) => [...new Set(p)].sort()),
  })
  .strict()
  .refine((b) => b.all_projects !== b.project_ids.length > 0, {
    message: "exactly one of all_projects or project_ids",
    path: ["project_ids"],
  });

export const rotateApiKeyBodySchema = z
  .object({
    overlap_seconds: z.number().int().min(0).max(MAX_ROTATION_OVERLAP_SECONDS).optional(),
  })
  .strict();

export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;
export type RotateApiKeyBody = z.infer<typeof rotateApiKeyBodySchema>;
