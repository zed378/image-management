import { scoped, type Executor } from "@image-delivery/db";

import type { TenantContext } from "@image-delivery/tenancy";

// Reads of the tenancy chain other modules need to validate a reference:
// "is this application mine", "are these projects in that application".
// docs/DATABASE/03-04; the owning module of applications and projects.

export type ApplicationRef = {
  readonly id: string;
  readonly status: "active" | "suspended";
};

export type ProjectRef = {
  readonly id: string;
  readonly applicationId: string;
  readonly status: "active" | "archived";
};

export const createTenancyRepository = (db: Executor) => {
  const findApplication = async (
    ctx: TenantContext,
    applicationId: string,
    tx?: Executor,
  ): Promise<ApplicationRef | null> => {
    const row = await scoped(tx ?? db, ctx)
      .selectFrom("applications")
      .select(["id", "status"])
      .where("id", "=", applicationId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return row ?? null;
  };

  /** The subset of `projectIds` that are live projects of the application. */
  const findProjectIdsInApplication = async (
    ctx: TenantContext,
    applicationId: string,
    projectIds: readonly string[],
    tx?: Executor,
  ): Promise<string[]> => {
    if (projectIds.length === 0) return [];
    const rows = await scoped(tx ?? db, ctx)
      .selectFrom("projects")
      .select("id")
      .where("application_id", "=", applicationId)
      .where("id", "in", projectIds)
      .where("deleted_at", "is", null)
      .execute();
    return rows.map((r) => r.id);
  };

  const findProject = async (
    ctx: TenantContext,
    projectId: string,
    tx?: Executor,
  ): Promise<ProjectRef | null> => {
    const row = await scoped(tx ?? db, ctx)
      .selectFrom("projects")
      .select(["id", "application_id", "status"])
      .where("id", "=", projectId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return row ? { id: row.id, applicationId: row.application_id, status: row.status } : null;
  };

  return { findApplication, findProjectIdsInApplication, findProject };
};

export type TenancyRepository = ReturnType<typeof createTenancyRepository>;
