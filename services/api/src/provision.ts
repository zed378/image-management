// `node dist/provision.js` (production image) or `pnpm provision` (local):
// create a tenant, its first application and project, and a bootstrap API
// key, printed once. The way to obtain the first key on a fresh installation
// (every other key-management path requires a key). Needs DATABASE_URL and
// API_KEY_PEPPER only.
//
//   provision --tenant-name "Acme" --tenant-slug acme \
//             [--application-slug default] [--project-slug production] \
//             [--permissions asset:read,asset:create]

import { parseArgs } from "node:util";

import { z } from "zod";

import {
  ConfigError,
  credentialsFragment,
  databaseFragment,
  parseConfig,
  processFragment,
  refineCredentials,
  toDatabaseConfig,
  withDotEnv,
} from "@image-delivery/config";
import { createDb } from "@image-delivery/db";
import { isPermission } from "@image-delivery/tenancy";

import { createApiKeyService } from "./modules/api-keys/api-key.service";
import { provisionTenant } from "./modules/tenancy/tenancy.provisioning";

const USAGE =
  "usage: provision --tenant-name <name> --tenant-slug <slug> " +
  "[--application-slug default] [--project-slug production] [--permissions a:b,c:d]\n";

/** Until P1-04's matrix exists, the bootstrap key is scoped to key management. */
const DEFAULT_PERMISSIONS = "api-key:create,api-key:read,api-key:update,api-key:delete";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      "tenant-name": { type: "string" },
      "tenant-slug": { type: "string" },
      "application-slug": { type: "string", default: "default" },
      "project-slug": { type: "string", default: "production" },
      permissions: { type: "string", default: DEFAULT_PERMISSIONS },
    },
    strict: true,
  });
  const tenantName = values["tenant-name"];
  const tenantSlug = values["tenant-slug"];
  if (!tenantName || !tenantSlug) {
    process.stderr.write(USAGE);
    process.exit(2);
  }

  const permissions = values.permissions.split(",").map((p) => p.trim());
  const unknown = permissions.filter((p) => !isPermission(p));
  if (unknown.length > 0) {
    process.stderr.write(`provision: unknown permission(s): ${unknown.join(", ")}
`);
    process.exit(2);
  }

  let env;
  try {
    env = parseConfig(
      z
        .object({ ...processFragment, ...databaseFragment, ...credentialsFragment })
        .superRefine(refineCredentials),
      withDotEnv(process.env),
    );
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`provision: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const db = createDb({ ...toDatabaseConfig(env), applicationName: "provision" });
  try {
    const result = await provisionTenant(
      db,
      createApiKeyService({ db, pepper: env.API_KEY_PEPPER }),
      {
        tenantName,
        tenantSlug,
        applicationSlug: values["application-slug"],
        projectSlug: values["project-slug"],
        keyPermissions: permissions.filter(isPermission),
      },
    );
    process.stdout.write(
      [
        `tenant_id       ${result.tenantId}`,
        `application_id  ${result.applicationId}`,
        `project_id      ${result.projectId}`,
        `api_key_id      ${result.apiKeyId}`,
        `api_key         ${result.apiKey}`,
        "",
        "The API key is shown once and is not stored. Keep it in a secret store.",
        "",
      ].join("\n"),
    );
  } finally {
    await db.destroy();
  }
};

main().catch((err: unknown) => {
  // A duplicate slug is the common failure; never print the key or a row.
  process.stderr.write(`provision: failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
