import type { ColumnType, Generated } from "kysely";

// Row types for every table, in snake_case exactly as the columns are named.
// Repositories convert these to camelCase domain types through mappers; a raw
// row never leaves a repository (docs/ENGINEERING/07).

/** Read as Date; written as Date or ISO string; optional on insert when defaulted. */
export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
/** jsonb read as a parsed value, written as a JSON string or value. */
export type Json<T> = ColumnType<T, T | string | undefined, T | string>;

export type TenantStatus = "active" | "suspended";
export type Plan = "free" | "pro" | "business" | "enterprise";
export type UserRole = "owner" | "admin" | "developer" | "viewer";
export type UserStatus = "active" | "disabled";
export type ApplicationStatus = "active" | "suspended";
export type ProjectStatus = "active" | "archived";

export interface TenantsTable {
  id: string;
  name: string;
  slug: string;
  plan: ColumnType<Plan, Plan | undefined, Plan>;
  status: ColumnType<TenantStatus, TenantStatus | undefined, TenantStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface UsersTable {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  role: UserRole;
  status: ColumnType<UserStatus, UserStatus | undefined, UserStatus>;
  last_login_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface ApplicationsTable {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: ColumnType<ApplicationStatus, ApplicationStatus | undefined, ApplicationStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

/** Per-project runtime settings (docs/MULTI-TENANCY/03-PROJECT-MODEL.md). */
export type ProjectSettings = {
  /** ADR-014: snap w/h to a width ladder. Off by default. */
  readonly dimension_ladder?: boolean;
  /** ADR-013: reject foreign query parameters too. Off by default. */
  readonly strict_parameters?: boolean;
};

export interface ProjectsTable {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  slug: string;
  settings: Json<ProjectSettings>;
  status: ColumnType<ProjectStatus, ProjectStatus | undefined, ProjectStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

// ==========================================
// ASSET DOMAIN (P1-01, docs/DATABASE/05-11)
// ==========================================

/** Defaulted on insert, required thereafter. */
type Defaulted<T> = ColumnType<T, T | undefined, T>;
/** Nullable and optional on insert. */
type Optional<T> = ColumnType<T | null, T | null | undefined, T | null>;

export type AssetStatus = "pending" | "processing" | "ready" | "failed";
export type Visibility = "private" | "public" | "unlisted" | "signed" | "expiring";
export type VersionStatus = "pending" | "ready" | "failed";
export type DerivativeStatus = "pending" | "ready" | "failed";
export type DerivativeFormat = "avif" | "webp" | "jpeg" | "png";
export type AvifState = "pending" | "unavailable" | "not_beneficial";
export type MetadataSource = "user" | "extracted";

export interface FoldersTable {
  id: string;
  tenant_id: string;
  project_id: string;
  parent_id: Optional<string>;
  name: string;
  path: string;
  depth: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface AssetsTable {
  id: string;
  tenant_id: string;
  project_id: string;
  folder_id: Optional<string>;
  current_version_id: Optional<string>;
  original_filename: string;
  status: Defaulted<AssetStatus>;
  visibility: Defaulted<Visibility>;
  alt_text: Optional<string>;
  description: Optional<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface AssetVersionsTable {
  id: string;
  tenant_id: string;
  project_id: string;
  asset_id: string;
  version_number: number;
  status: Defaulted<VersionStatus>;
  storage_key: string;
  content_type: Optional<string>;
  byte_size: Optional<number>;
  width_px: Optional<number>;
  height_px: Optional<number>;
  checksum_sha256: Optional<string>;
  focal_x: Optional<number>;
  focal_y: Optional<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface AssetMetadataTable {
  id: string;
  tenant_id: string;
  project_id: string;
  asset_id: string;
  source: Defaulted<MetadataSource>;
  key: string;
  value: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ImageDerivativesTable {
  id: string;
  tenant_id: string;
  project_id: string;
  asset_version_id: string;
  params_hash: string;
  canonical_params: string;
  format: DerivativeFormat;
  status: Defaulted<DerivativeStatus>;
  storage_key: string;
  byte_size: Optional<number>;
  width_px: Optional<number>;
  height_px: Optional<number>;
  avif_state: Optional<AvifState>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TagsTable {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface AssetTagsTable {
  tenant_id: string;
  project_id: string;
  asset_id: string;
  tag_id: string;
  created_at: Timestamp;
}

export interface CollectionsTable {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  description: Optional<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface CollectionAssetsTable {
  tenant_id: string;
  project_id: string;
  collection_id: string;
  asset_id: string;
  position: number;
  created_at: Timestamp;
}

// ==========================================
// ACCESS (P1-01, docs/DATABASE/12-13)
// ==========================================

export type GrantRole = "admin" | "developer" | "viewer";
export type ApiKeyEnvironment = "live" | "test";
export type ApiKeyStatus = "active" | "suspended" | "revoked";

export interface RoleAssignmentsTable {
  id: string;
  tenant_id: string;
  user_id: string;
  role: GrantRole;
  application_id: string;
  project_id: Optional<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ApiKeysTable {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  environment: ApiKeyEnvironment;
  key_hash: string;
  permissions: string[];
  all_projects: Defaulted<boolean>;
  status: Defaulted<ApiKeyStatus>;
  expires_at: NullableTimestamp;
  revoked_at: NullableTimestamp;
  last_used_at: NullableTimestamp;
  created_by_user_id: Optional<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ApiKeyProjectsTable {
  tenant_id: string;
  application_id: string;
  api_key_id: string;
  project_id: string;
  created_at: Timestamp;
}

// ==========================================
// PLATFORM (P1-01, docs/DATABASE/14-17)
// ==========================================

export type WebhookEvent =
  | "asset.uploaded"
  | "asset.updated"
  | "asset.deleted"
  | "processing.completed"
  | "processing.failed";
export type WebhookStatus = "active" | "disabled";
export type DeliveryOutcome = "succeeded" | "failed" | "dead_lettered";
export type UsageMetric =
  "storage_bytes" | "bandwidth_bytes" | "transformations" | "requests" | "assets";
export type QuotaEnforcement = "hard" | "soft";
export type AuditActorType = "user" | "api_key" | "platform_admin" | "system";

export interface WebhooksTable {
  id: string;
  tenant_id: string;
  application_id: string;
  url: string;
  events: WebhookEvent[];
  secret_ciphertext: Buffer;
  description: Optional<string>;
  status: Defaulted<WebhookStatus>;
  disabled_reason: Optional<"manual" | "failing">;
  consecutive_failures: Defaulted<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: NullableTimestamp;
}

export interface WebhookDeliveriesTable {
  id: string;
  tenant_id: string;
  webhook_id: string;
  event_id: string;
  event_type: WebhookEvent;
  attempt: number;
  outcome: DeliveryOutcome;
  response_status: Optional<number>;
  error_code: Optional<string>;
  duration_ms: Optional<number>;
  attempted_at: Timestamp;
  created_at: Timestamp;
}

export interface UsageTable {
  tenant_id: string;
  application_id: string;
  project_id: string;
  metric: UsageMetric;
  /** A UTC calendar day, 'YYYY-MM-DD' (parsed as a string; see connection.ts). */
  day: string;
  value: Defaulted<number>;
  updated_at: Timestamp;
}

export interface QuotasTable {
  plan: Plan;
  metric: UsageMetric;
  /** null: unlimited. */
  limit_value: number | null;
  enforcement: QuotaEnforcement;
  updated_at: Timestamp;
}

export interface QuotaOverridesTable {
  tenant_id: string;
  metric: UsageMetric;
  limit_value: number | null;
  enforcement: QuotaEnforcement;
  reason: string;
  expires_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AuditLogsTable {
  id: string;
  tenant_id: string;
  actor_type: AuditActorType;
  actor_id: Optional<string>;
  action: string;
  target_type: string;
  target_id: Optional<string>;
  application_id: Optional<string>;
  project_id: Optional<string>;
  request_id: Optional<string>;
  ip: Optional<string>;
  metadata: Json<Record<string, unknown>>;
  created_at: Timestamp;
}

export interface Database {
  tenants: TenantsTable;
  users: UsersTable;
  applications: ApplicationsTable;
  projects: ProjectsTable;
  folders: FoldersTable;
  assets: AssetsTable;
  asset_versions: AssetVersionsTable;
  asset_metadata: AssetMetadataTable;
  image_derivatives: ImageDerivativesTable;
  tags: TagsTable;
  asset_tags: AssetTagsTable;
  collections: CollectionsTable;
  collection_assets: CollectionAssetsTable;
  role_assignments: RoleAssignmentsTable;
  api_keys: ApiKeysTable;
  api_key_projects: ApiKeyProjectsTable;
  webhooks: WebhooksTable;
  webhook_deliveries: WebhookDeliveriesTable;
  usage: UsageTable;
  quotas: QuotasTable;
  quota_overrides: QuotaOverridesTable;
  audit_logs: AuditLogsTable;
}

// Re-exported so repositories need not import kysely for these helpers.
export type { Generated };
