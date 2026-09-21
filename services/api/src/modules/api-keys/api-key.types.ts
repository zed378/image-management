import type { ApiKeyEnvironment } from "./api-key.crypto";

export type ApiKeyStatus = "active" | "suspended" | "revoked";

/** The domain shape. Never carries the secret or its hash. */
export type ApiKey = {
  readonly id: string;
  readonly applicationId: string;
  readonly name: string;
  readonly environment: ApiKeyEnvironment;
  /** `ak_live_<id>`: the non-secret part, for display. */
  readonly prefix: string;
  readonly permissions: readonly string[];
  readonly projectAccess: "all" | readonly string[];
  readonly status: ApiKeyStatus;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** Returned by create and rotate only: the one time the plaintext exists. */
export type IssuedApiKey = {
  readonly apiKey: ApiKey;
  readonly plaintext: string;
};

/** What a verified key grants; the input to building a TenantContext (P1-03). */
export type ApiKeyPrincipal = {
  readonly keyId: string;
  readonly tenantId: string;
  readonly applicationId: string;
  readonly permissions: readonly string[];
  readonly projectAccess: "all" | readonly string[];
};

export type ApiKeyWire = {
  readonly id: string;
  readonly application_id: string;
  readonly name: string;
  readonly environment: ApiKeyEnvironment;
  readonly prefix: string;
  readonly permissions: readonly string[];
  readonly all_projects: boolean;
  readonly project_ids: readonly string[];
  readonly status: ApiKeyStatus;
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly last_used_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};
