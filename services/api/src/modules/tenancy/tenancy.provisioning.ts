import { scoped, unsafeUnscoped, type Db } from "@image-delivery/db";
import { newId } from "@image-delivery/schema";
import { systemContext, type Permission } from "@image-delivery/tenancy";

import { audited } from "../audit/audit";

import type { ApiKeyService } from "../api-keys/api-key.service";

// Operator bootstrap: a tenant, its first application and project, and an
// API key to use them (docs/DEVOPS/, P1-02). Every other way of creating a
// key needs a key; this is the way to get the first one on a fresh
// installation. Run from the CLI (src/cli/provision.ts), never from a request.

export type ProvisionInput = {
  readonly tenantName: string;
  readonly tenantSlug: string;
  readonly applicationSlug: string;
  readonly projectSlug: string;
  readonly keyPermissions: readonly Permission[];
};

export type Provisioned = {
  readonly tenantId: string;
  readonly applicationId: string;
  readonly projectId: string;
  readonly apiKeyId: string;
  /** Shown once. */
  readonly apiKey: string;
};

export const provisionTenant = async (
  db: Db,
  apiKeys: ApiKeyService,
  input: ProvisionInput,
): Promise<Provisioned> => {
  const tenantId = newId();
  const applicationId = newId();
  const projectId = newId();
  const ctx = systemContext(tenantId);

  await audited(db, ctx, async (tx) => {
    // tenants is global (docs/DATABASE/00): creating one is the definition of
    // crossing no tenant boundary, but it is still an unscoped write.
    await unsafeUnscoped(tx, "tenant-provisioning")
      .insertInto("tenants")
      .values({ id: tenantId, name: input.tenantName, slug: input.tenantSlug })
      .execute();
    await scoped(tx, ctx)
      .insertInto("applications", {
        id: applicationId,
        name: input.applicationSlug,
        slug: input.applicationSlug,
      })
      .execute();
    await scoped(tx, ctx)
      .insertInto("projects", {
        id: projectId,
        application_id: applicationId,
        name: input.projectSlug,
        slug: input.projectSlug,
      })
      .execute();
    return {
      result: undefined,
      audit: {
        action: "tenant.provisioned",
        targetType: "tenant",
        targetId: tenantId,
        applicationId,
        projectId,
        metadata: { slug: input.tenantSlug },
      },
    };
  });

  const issued = await apiKeys.create(ctx, applicationId, {
    name: "bootstrap",
    environment: "live",
    permissions: [...input.keyPermissions],
    all_projects: true,
    project_ids: [],
  });
  return {
    tenantId,
    applicationId,
    projectId,
    apiKeyId: issued.apiKey.id,
    apiKey: issued.plaintext,
  };
};
