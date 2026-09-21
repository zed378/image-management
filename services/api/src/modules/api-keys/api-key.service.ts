import { AppError } from "@image-delivery/errors";

import { createCredentialLookup } from "./api-key.authentication";
import { DEFAULT_ROTATION_OVERLAP_SECONDS } from "./api-key.constants";
import {
  DECOY_HASH,
  generateApiKey,
  hashApiKeySecret,
  parseApiKey,
  verifyApiKeySecret,
} from "./api-key.crypto";
import { createApiKeyRepository } from "./api-key.repository";
import { createTenancyRepository } from "../tenancy/tenancy.repository";

import type { CreateApiKeyBody, RotateApiKeyBody } from "./api-key.schema";
import type { ApiKey, ApiKeyPrincipal, IssuedApiKey } from "./api-key.types";
import type { LastUsedTracker } from "./last-used-tracker";
import type { Db } from "@image-delivery/db";
import type { TenantContext } from "@image-delivery/tenancy";

// API-key lifecycle and verification (docs/SECURITY/04, docs/DATABASE/13,
// ADR-022 point 4). Rules live here; the repository only reads and writes.
//
//   - The plaintext exists in exactly two return values: create and rotate.
//   - Authentication failures are indistinguishable (SEC-AUTH-04): every
//     reason returns null, and the caller answers api_key_invalid.
//   - Revocation is a read of the row on every authentication, so it takes
//     effect on the next request (SEC-AUTH-05). A credential cache added
//     later must be invalidated synchronously on revoke.

export type ApiKeyServiceDeps = {
  readonly db: Db;
  readonly pepper: string;
  readonly now?: () => Date;
  readonly lastUsed?: LastUsedTracker;
};

export const createApiKeyService = (deps: ApiKeyServiceDeps) => {
  const now = deps.now ?? (() => new Date());
  const keys = createApiKeyRepository(deps.db);
  const tenancy = createTenancyRepository(deps.db);
  const credentials = createCredentialLookup(deps.db);

  /**
   * A credential bound to an application manages only that application's
   * keys; another application's id is answered as not found (SEC-TEN-03).
   */
  const assertApplicationInScope = (ctx: TenantContext, applicationId: string): void => {
    if (ctx.applicationId !== null && ctx.applicationId !== applicationId) {
      throw new AppError("application_not_found");
    }
  };

  /**
   * No escalation through key management: a caller can only issue (or, by
   * rotating, obtain the plaintext of) a key whose permissions and project
   * coverage are within its own. Platform-internal (system) contexts, which
   * hold no permissions of their own, are exempt.
   */
  const assertWithinCallerGrant = (
    ctx: TenantContext,
    permissions: readonly string[],
    projectAccess: "all" | readonly string[],
  ): void => {
    if (ctx.actor.type === "system") return;
    const missing = permissions.filter((p) => !ctx.permissions.has(p));
    const callerProjects = ctx.projectAccess;
    const broaderCoverage =
      callerProjects !== "all" &&
      (projectAccess === "all" || projectAccess.some((p) => !callerProjects.has(p)));
    if (missing.length > 0 || broaderCoverage) {
      throw new AppError("permission_denied", {
        message: "A key cannot grant more than the credential that issues it.",
        details: [
          ...missing.map(() => ({ field: "permissions", reason: "exceeds_caller" })),
          ...(broaderCoverage ? [{ field: "project_ids", reason: "exceeds_caller" }] : []),
        ],
      });
    }
  };

  const requireKey = async (ctx: TenantContext, applicationId: string, keyId: string) => {
    assertApplicationInScope(ctx, applicationId);
    const key = await keys.findById(ctx, applicationId, keyId);
    // Absent and foreign-tenant are indistinguishable (SEC-TEN-03).
    if (!key) throw new AppError("api_key_not_found");
    return key;
  };

  // ==========================================
  // LIFECYCLE
  // ==========================================

  const create = async (
    ctx: TenantContext,
    applicationId: string,
    body: CreateApiKeyBody,
  ): Promise<IssuedApiKey> =>
    deps.db.transaction().execute(async (tx) => {
      assertApplicationInScope(ctx, applicationId);
      assertWithinCallerGrant(ctx, body.permissions, body.all_projects ? "all" : body.project_ids);
      const application = await tenancy.findApplication(ctx, applicationId, tx);
      if (!application) throw new AppError("application_not_found");

      const found = await tenancy.findProjectIdsInApplication(
        ctx,
        applicationId,
        body.project_ids,
        tx,
      );
      if (found.length !== body.project_ids.length) {
        // Unknown, deleted, or in another application: one answer for all.
        throw new AppError("project_not_found", {
          details: body.project_ids
            .filter((id) => !found.includes(id))
            .map(() => ({ field: "project_ids", reason: "not_found" })),
        });
      }

      const generated = generateApiKey(body.environment);
      const apiKey = await keys.insert(
        ctx,
        {
          id: generated.id,
          applicationId,
          name: body.name,
          environment: body.environment,
          keyHash: hashApiKeySecret(deps.pepper, generated.id, generated.secret),
          permissions: body.permissions,
          allProjects: body.all_projects,
          projectIds: body.project_ids,
          createdByUserId: ctx.actor.type === "user" ? ctx.actor.id : null,
        },
        tx,
      );
      return { apiKey, plaintext: generated.plaintext };
    });

  const list = async (ctx: TenantContext, applicationId: string): Promise<ApiKey[]> => {
    assertApplicationInScope(ctx, applicationId);
    return keys.listByApplication(ctx, applicationId);
  };

  const get = (ctx: TenantContext, applicationId: string, keyId: string): Promise<ApiKey> =>
    requireKey(ctx, applicationId, keyId);

  /**
   * Issue a replacement with the same name, permissions and projects; the old
   * key keeps working for the overlap window, then expires (P1-02 step 3).
   */
  const rotate = async (
    ctx: TenantContext,
    applicationId: string,
    keyId: string,
    body: RotateApiKeyBody,
  ): Promise<IssuedApiKey> =>
    deps.db.transaction().execute(async (tx) => {
      assertApplicationInScope(ctx, applicationId);
      const old = await keys.findById(ctx, applicationId, keyId, tx);
      if (!old) throw new AppError("api_key_not_found");
      // Rotating hands back a working plaintext for the old key's grant.
      assertWithinCallerGrant(ctx, old.permissions, old.projectAccess);
      if (old.status !== "active") {
        throw new AppError("invalid_state", { message: "Only an active API key can be rotated." });
      }

      const generated = generateApiKey(old.environment);
      const apiKey = await keys.insert(
        ctx,
        {
          id: generated.id,
          applicationId,
          name: old.name,
          environment: old.environment,
          keyHash: hashApiKeySecret(deps.pepper, generated.id, generated.secret),
          permissions: old.permissions,
          allProjects: old.projectAccess === "all",
          projectIds: old.projectAccess === "all" ? [] : old.projectAccess,
          createdByUserId: ctx.actor.type === "user" ? ctx.actor.id : null,
        },
        tx,
      );
      const overlapMs = (body.overlap_seconds ?? DEFAULT_ROTATION_OVERLAP_SECONDS) * 1000;
      await keys.expireBy(ctx, old.id, new Date(now().getTime() + overlapMs), tx);
      return { apiKey, plaintext: generated.plaintext };
    });

  /** Immediate and permanent (SEC-AUTH-05). Idempotent. */
  const revoke = async (
    ctx: TenantContext,
    applicationId: string,
    keyId: string,
  ): Promise<ApiKey> => {
    await requireKey(ctx, applicationId, keyId);
    await keys.revoke(ctx, keyId);
    return requireKey(ctx, applicationId, keyId);
  };

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  /** The principal a presented key proves, or null -- for every failure alike. */
  const authenticate = async (presented: string): Promise<ApiKeyPrincipal | null> => {
    const parsed = parseApiKey(presented);
    const row = parsed ? await credentials.findForAuthentication(parsed.id) : null;
    // Always one HMAC and one constant-time compare, found or not.
    const secretMatches = verifyApiKeySecret(
      deps.pepper,
      parsed?.id ?? "",
      parsed?.secret ?? "",
      row?.key_hash ?? DECOY_HASH,
    );
    if (!parsed || !row || !secretMatches) return null;
    if (row.environment !== parsed.environment) return null;
    if (row.status !== "active" || row.application_status !== "active") return null;
    if (row.tenant_status !== "active") return null;
    if (row.expires_at && row.expires_at.getTime() <= now().getTime()) return null;

    deps.lastUsed?.seen(row.id);
    return {
      keyId: row.id,
      tenantId: row.tenant_id,
      applicationId: row.application_id,
      permissions: row.permissions,
      projectAccess: row.all_projects ? "all" : row.project_ids,
    };
  };

  return { create, list, get, rotate, revoke, authenticate };
};

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
