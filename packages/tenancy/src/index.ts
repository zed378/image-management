// TenantContext, permissions and the RBAC matrix (P1-04).
export { inProject, systemContext, type Actor, type TenantContext } from "./context";
export {
  effectivePermissions,
  isPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
  type RoleGrant,
  type Scope,
} from "./permissions";
