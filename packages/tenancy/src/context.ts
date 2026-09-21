// TenantContext: who is acting, for which tenant, within which project.
// docs/MULTI-TENANCY/01-03, ADR-005, docs/ENGINEERING/13 section 1.
//
// Built from the *verified credential only* -- never from a header, query
// parameter, body field or path segment a caller controls. It is the first
// parameter of every service and repository function, and it structurally
// satisfies packages/db's ScopeContext, so it is what scoped() filters on.

export type Actor =
  | { readonly type: "api_key"; readonly id: string }
  | { readonly type: "user"; readonly id: string }
  | { readonly type: "system"; readonly id: null };

export type TenantContext = {
  readonly tenantId: string;
  /** The application a credential belongs to; null for a tenant-wide actor. */
  readonly applicationId: string | null;
  /** The project this operation runs in; null for tenant/application-level work. */
  readonly projectId: string | null;
  readonly actor: Actor;
  /** Granted permissions (the P1-04 vocabulary). */
  readonly permissions: ReadonlySet<string>;
  /** The projects the credential may touch: every project of its application, or these. */
  readonly projectAccess: "all" | ReadonlySet<string>;
  readonly requestId: string | null;
  /** The client address (after trusted proxies), for the audit trail. */
  readonly sourceIp: string | null;
};

/**
 * A context for platform-internal work on one tenant (CLI provisioning,
 * jobs). It carries no permissions: code running as the system is trusted by
 * where it runs, not by what it holds, and must not reach request handlers.
 */
export const systemContext = (
  tenantId: string,
  requestId: string | null = null,
): TenantContext => ({
  tenantId,
  applicationId: null,
  projectId: null,
  actor: { type: "system", id: null },
  permissions: new Set(),
  projectAccess: "all",
  requestId,
  sourceIp: null,
});

/** The same context, narrowed to one project. Access is checked by the caller (P1-05). */
export const inProject = (ctx: TenantContext, projectId: string): TenantContext => ({
  ...ctx,
  projectId,
});
