// The permission vocabulary and the role -> permission matrix
// (docs/SECURITY/08-RBAC.md, P1-04). Permissions are code, never rows
// (ADR-022 point 1): a closed union checked at compile time, so a typo in a
// route's `permission` is a type error, not a route that grants nothing.
//
// The matrix is written out in docs/SECURITY/08; permissions.test.ts parses
// that table and fails if it and ROLE_PERMISSIONS differ in any cell.

export const PERMISSIONS = [
  "asset:create",
  "asset:read",
  "asset:update",
  "asset:delete",
  "asset:restore",
  "asset:tenant:purge",
  "derivative:transform",
  "signed-url:sign",
  "folder:create",
  "folder:read",
  "folder:update",
  "folder:delete",
  "collection:create",
  "collection:read",
  "collection:update",
  "collection:delete",
  "tag:create",
  "tag:read",
  "tag:update",
  "tag:delete",
  "project:create",
  "project:read",
  "project:update",
  "project:delete",
  "application:read",
  "application:update",
  "api-key:create",
  "api-key:read",
  "api-key:update",
  "api-key:delete",
  "webhook:create",
  "webhook:read",
  "webhook:update",
  "webhook:delete",
  "usage:read",
  "audit-log:read",
  "member:read",
  "member:update",
  "tenant:read",
  "tenant:update",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);

export const ROLES = ["owner", "admin", "developer", "viewer"] as const;
export type Role = (typeof ROLES)[number];

const VIEWER: readonly Permission[] = [
  "asset:read",
  "folder:read",
  "collection:read",
  "tag:read",
  "project:read",
  "application:read",
  "usage:read",
];

const DEVELOPER: readonly Permission[] = [
  ...VIEWER,
  "asset:create",
  "asset:update",
  "asset:delete",
  "asset:restore",
  "derivative:transform",
  "signed-url:sign",
  "folder:create",
  "folder:update",
  "folder:delete",
  "collection:create",
  "collection:update",
  "collection:delete",
  "tag:create",
  "tag:update",
  "tag:delete",
  "api-key:read",
  "webhook:read",
];

const ADMIN: readonly Permission[] = [
  ...DEVELOPER,
  "project:create",
  "project:update",
  "project:delete",
  "application:update",
  "webhook:create",
  "webhook:update",
  "webhook:delete",
  "audit-log:read",
  "member:read",
  "tenant:read",
];

/**
 * Owner holds everything. Only owner may manage credentials and members,
 * change tenant settings, or purge (SEC-AZ-03): those are the actions that
 * can take the tenant away from its owner or destroy it irrecoverably.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set(ADMIN),
  developer: new Set(DEVELOPER),
  viewer: new Set(VIEWER),
};

// ==========================================
// EFFECTIVE PERMISSIONS
// ==========================================

/** A narrower-than-tenant grant (docs/DATABASE/12, role_assignments). */
export type RoleGrant = {
  readonly role: Exclude<Role, "owner">;
  readonly applicationId: string;
  /** null: the whole application. */
  readonly projectId: string | null;
};

/** Where an action happens: the tenant, one application, or one project of it. */
export type Scope = {
  readonly applicationId: string | null;
  readonly projectId: string | null;
};

/**
 * A user's permissions in `scope`: the union of the tenant-wide role's and
 * every grant that covers the scope. A grant on an application covers all
 * its projects; a grant on a project covers only that project, and never
 * the application or tenant level. Grants only add; nothing subtracts.
 */
export const effectivePermissions = (
  tenantRole: Role,
  grants: readonly RoleGrant[],
  scope: Scope,
): ReadonlySet<Permission> => {
  const result = new Set(ROLE_PERMISSIONS[tenantRole]);
  for (const grant of grants) {
    const applies =
      scope.applicationId !== null &&
      grant.applicationId === scope.applicationId &&
      (grant.projectId === null || grant.projectId === scope.projectId);
    if (applies) for (const p of ROLE_PERMISSIONS[grant.role]) result.add(p);
  }
  return result;
};
