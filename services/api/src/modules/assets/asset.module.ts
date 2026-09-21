import { createAssetService } from "./asset.service";
import { createIdempotencyService } from "../idempotency/idempotency.service";
import { createProjectAccess } from "../tenancy/project-access";

import type { AssetRouteDeps } from "./asset.routes";
import type { Db } from "@image-delivery/db";
import type { StorageAdapter } from "@image-delivery/storage-adapter";

/** Everything the asset routes need, built from the process's connections. */
export const createAssetModule = (deps: {
  readonly db: Db;
  readonly storage: StorageAdapter;
}): AssetRouteDeps => ({
  assets: createAssetService(deps),
  projects: createProjectAccess(deps.db),
  idempotency: createIdempotencyService(deps.db),
});
