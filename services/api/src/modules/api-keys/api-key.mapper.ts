import { displayPrefix } from "./api-key.crypto";

import type { ApiKey, ApiKeyWire } from "./api-key.types";
import type { ApiKeysTable } from "@image-delivery/db";
import type { Selectable } from "kysely";

/** The columns a repository selects: never key_hash. */
export type ApiKeyRow = Omit<Selectable<ApiKeysTable>, "key_hash" | "tenant_id">;

export const toApiKey = (row: ApiKeyRow, projectIds: readonly string[]): ApiKey => ({
  id: row.id,
  applicationId: row.application_id,
  name: row.name,
  environment: row.environment,
  prefix: displayPrefix(row.environment, row.id),
  permissions: row.permissions,
  projectAccess: row.all_projects ? "all" : projectIds,
  status: row.status,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  lastUsedAt: row.last_used_at,
  createdByUserId: row.created_by_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toApiKeyWire = (key: ApiKey): ApiKeyWire => ({
  id: key.id,
  application_id: key.applicationId,
  name: key.name,
  environment: key.environment,
  prefix: key.prefix,
  permissions: key.permissions,
  all_projects: key.projectAccess === "all",
  project_ids: key.projectAccess === "all" ? [] : key.projectAccess,
  status: key.status,
  expires_at: key.expiresAt?.toISOString() ?? null,
  revoked_at: key.revokedAt?.toISOString() ?? null,
  last_used_at: key.lastUsedAt?.toISOString() ?? null,
  created_at: key.createdAt.toISOString(),
  updated_at: key.updatedAt.toISOString(),
});
