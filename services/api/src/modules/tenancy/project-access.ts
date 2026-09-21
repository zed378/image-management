import { AppError } from "@image-delivery/errors";
import { inProject, type TenantContext } from "@image-delivery/tenancy";

import { createTenancyRepository } from "./tenancy.repository";

import type { Executor } from "@image-delivery/db";

// Entering a project named in a request path (P1-05, docs/MULTI-TENANCY/03).
// The project must be in the caller's tenant, in the caller's application
// (for an application-bound credential), and within the credential's
// project coverage. Every failure is the same 404 -- a caller cannot learn
// that a project exists outside its reach (SEC-TEN-03).

export const createProjectAccess = (db: Executor) => {
  const tenancy = createTenancyRepository(db);

  const enter = async (
    ctx: TenantContext,
    projectId: string,
    intent: "read" | "write",
  ): Promise<TenantContext> => {
    if (ctx.projectAccess !== "all" && !ctx.projectAccess.has(projectId)) {
      throw new AppError("project_not_found");
    }
    const project = await tenancy.findProject(ctx, projectId);
    if (!project) throw new AppError("project_not_found");
    if (ctx.applicationId !== null && project.applicationId !== ctx.applicationId) {
      throw new AppError("project_not_found");
    }
    // An archived project keeps serving reads and delivery, refuses writes
    // (docs/DATABASE/04).
    if (intent === "write" && project.status === "archived") {
      throw new AppError("invalid_state", { message: "The project is archived." });
    }
    return inProject(ctx, projectId);
  };

  return { enter };
};

export type ProjectAccess = ReturnType<typeof createProjectAccess>;
