import { newId } from "@image-delivery/schema";

import type { Db } from "@image-delivery/db";

// Minimal tenancy fixtures for integration tests: a tenant with one
// application and one project, or more projects on demand. Every id is a
// fresh ULID, so fixtures never collide across tests sharing a database.

export type SeededTenant = {
  readonly tenantId: string;
  readonly applicationId: string;
  readonly projectId: string;
};

let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

export const seedTenant = async (db: Db): Promise<SeededTenant> => {
  const tenantId = newId();
  const applicationId = newId();
  const projectId = newId();
  await db
    .insertInto("tenants")
    .values({ id: tenantId, name: "Tenant", slug: unique("t") })
    .execute();
  await db
    .insertInto("applications")
    .values({ id: applicationId, tenant_id: tenantId, name: "App", slug: unique("a") })
    .execute();
  await db
    .insertInto("projects")
    .values({
      id: projectId,
      tenant_id: tenantId,
      application_id: applicationId,
      name: "Project",
      slug: unique("p"),
    })
    .execute();
  return { tenantId, applicationId, projectId };
};

/** Another project in an existing application. */
export const seedProject = async (
  db: Db,
  tenant: Pick<SeededTenant, "tenantId" | "applicationId">,
): Promise<string> => {
  const projectId = newId();
  await db
    .insertInto("projects")
    .values({
      id: projectId,
      tenant_id: tenant.tenantId,
      application_id: tenant.applicationId,
      name: "Project",
      slug: unique("p"),
    })
    .execute();
  return projectId;
};

/** Another application (with one project) in an existing tenant. */
export const seedApplication = async (
  db: Db,
  tenantId: string,
): Promise<Omit<SeededTenant, "tenantId">> => {
  const applicationId = newId();
  await db
    .insertInto("applications")
    .values({ id: applicationId, tenant_id: tenantId, name: "App", slug: unique("a") })
    .execute();
  const projectId = await seedProject(db, { tenantId, applicationId });
  return { applicationId, projectId };
};
