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

export interface Database {
  tenants: TenantsTable;
  users: UsersTable;
  applications: ApplicationsTable;
  projects: ProjectsTable;
}

// Re-exported so repositories need not import kysely for these helpers.
export type { Generated };
