import { AppError } from "@image-delivery/errors";

import type { AssetRouteDeps } from "../../src/modules/assets/asset.routes";

// Asset routes for app-level tests that need no database: every lookup is
// "not found", so a route is reachable (for the route table) but inert.

export const stubAssets = (): AssetRouteDeps => ({
  assets: {
    get: () => Promise.reject(new AppError("asset_not_found")),
    upload: () => Promise.reject(new AppError("asset_not_found")),
  },
  projects: { enter: () => Promise.reject(new AppError("project_not_found")) },
  idempotency: {
    run: (_ctx, _key, _hash, work) => work().then((r) => ({ ...r, replayed: false })),
  },
});
