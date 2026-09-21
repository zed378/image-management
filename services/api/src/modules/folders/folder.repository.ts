import { scoped, type Executor } from "@image-delivery/db";

import type { TenantContext } from "@image-delivery/tenancy";

// Folder reads (docs/DATABASE/09). The folder CRUD module lands in P2-06;
// uploads need to know a folder exists in the project first.

export const createFolderRepository = (db: Executor) => {
  const exists = async (ctx: TenantContext, folderId: string, tx?: Executor): Promise<boolean> => {
    const row = await scoped(tx ?? db, ctx)
      .selectFrom("folders")
      .select("id")
      .where("id", "=", folderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return row !== undefined;
  };

  return { exists };
};
