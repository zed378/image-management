import { z } from "zod";

import { ULID_PATTERN } from "@image-delivery/schema";

import { toAssetWire } from "./asset.mapper";
import { tenantOf } from "../../http/authentication";
import { readUploadForm } from "../../http/multipart";
import { created, ok } from "../../http/respond";
import { bodyFingerprint, requestFingerprint } from "../idempotency/idempotency.service";

import type { AssetService } from "./asset.service";
import type { IdempotencyService } from "../idempotency/idempotency.service";
import type { ProjectAccess } from "../tenancy/project-access";
import type { FastifyInstance } from "fastify";

// /v1/projects/:project_id/assets (docs/API/10, docs/API/11).

const ulid = z.string().regex(ULID_PATTERN);
const projectParams = z.object({ project_id: ulid }).strict();
const assetParams = projectParams.extend({ asset_id: ulid }).strict();

/** The text fields of an upload form; everything else is refused. */
const uploadFieldsSchema = z
  .object({
    folder_id: ulid.optional(),
    visibility: z.enum(["private", "public", "unlisted", "signed", "expiring"]).default("private"),
    alt_text: z.string().max(1000).optional(),
    description: z.string().max(5000).optional(),
  })
  .strict();

export type AssetRouteDeps = {
  readonly assets: AssetService;
  readonly projects: ProjectAccess;
  readonly idempotency: IdempotencyService;
};

export const registerAssetRoutes = (app: FastifyInstance, deps: AssetRouteDeps): void => {
  app.post(
    "/projects/:project_id/assets",
    { config: { permission: "asset:create" } },
    async (request, reply) => {
      const { project_id } = projectParams.parse(request.params);
      const ctx = await deps.projects.enter(tenantOf(request), project_id, "write");
      const form = await readUploadForm(request);
      const fields = uploadFieldsSchema.parse(form.fields);
      const idempotencyKey = request.headers["idempotency-key"];

      const outcome = await deps.idempotency.run(
        ctx,
        typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        requestFingerprint(
          "POST /v1/projects/:project_id/assets",
          project_id,
          JSON.stringify(fields),
          form.filename ?? "",
          bodyFingerprint(form.file),
        ),
        async () => {
          const asset = await deps.assets.upload(ctx, {
            file: form.file,
            filename: form.filename,
            folderId: fields.folder_id ?? null,
            visibility: fields.visibility,
            altText: fields.alt_text ?? null,
            description: fields.description ?? null,
          });
          return { status: 201, body: toAssetWire(asset) };
        },
      );

      if (outcome.replayed) reply.header("idempotent-replayed", "true");
      const body = outcome.body as { id: string };
      return created(request, reply, outcome.body, `/v1/projects/${project_id}/assets/${body.id}`);
    },
  );

  app.get(
    "/projects/:project_id/assets/:asset_id",
    { config: { permission: "asset:read" } },
    async (request, reply) => {
      const { project_id, asset_id } = assetParams.parse(request.params);
      const ctx = await deps.projects.enter(tenantOf(request), project_id, "read");

      const asset = await deps.assets.get(ctx, asset_id);

      return ok(request, reply, toAssetWire(asset));
    },
  );
};
