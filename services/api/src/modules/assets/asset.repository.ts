import { scoped, type Executor, type Visibility } from "@image-delivery/db";

import type { Asset } from "./asset.types";
import type { ImageFacts } from "@image-delivery/image-engine";
import type { TenantContext } from "@image-delivery/tenancy";

// assets and asset_versions (docs/DATABASE/05-06), always through scoped().

export type NewAsset = {
  readonly id: string;
  readonly folderId: string | null;
  readonly originalFilename: string;
  readonly visibility: Visibility;
  readonly altText: string | null;
  readonly description: string | null;
};

export type NewVersion = {
  readonly id: string;
  readonly assetId: string;
  readonly versionNumber: number;
  readonly storageKey: string;
  readonly facts: ImageFacts;
};

export const createAssetRepository = (db: Executor) => {
  const findById = async (
    ctx: TenantContext,
    assetId: string,
    tx?: Executor,
  ): Promise<Asset | null> => {
    const row = await scoped(tx ?? db, ctx)
      .selectFrom("assets")
      .leftJoin("asset_versions as v", (j) =>
        j
          .onRef("v.id", "=", "assets.current_version_id")
          .onRef("v.tenant_id", "=", "assets.tenant_id"),
      )
      .select([
        "assets.id",
        "assets.project_id",
        "assets.folder_id",
        "assets.original_filename",
        "assets.status",
        "assets.visibility",
        "assets.alt_text",
        "assets.description",
        "assets.created_at",
        "assets.updated_at",
        "v.id as version_id",
        "v.version_number",
        "v.content_type",
        "v.byte_size",
        "v.width_px",
        "v.height_px",
        "v.checksum_sha256",
        "v.created_at as version_created_at",
      ])
      .where("assets.id", "=", assetId)
      .where("assets.deleted_at", "is", null)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      folderId: row.folder_id,
      originalFilename: row.original_filename,
      status: row.status,
      visibility: row.visibility,
      altText: row.alt_text,
      description: row.description,
      currentVersion:
        row.version_id && row.version_number !== null && row.version_created_at
          ? {
              id: row.version_id,
              versionNumber: row.version_number,
              contentType: row.content_type,
              byteSize: row.byte_size,
              width: row.width_px,
              height: row.height_px,
              checksumSha256: row.checksum_sha256,
              createdAt: row.version_created_at,
            }
          : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const insertAsset = async (ctx: TenantContext, a: NewAsset, tx: Executor): Promise<void> => {
    await scoped(tx, ctx)
      .insertInto("assets", {
        id: a.id,
        folder_id: a.folderId,
        original_filename: a.originalFilename,
        visibility: a.visibility,
        alt_text: a.altText,
        description: a.description,
      })
      .execute();
  };

  /** A version whose bytes are already validated and stored: inserted ready, with its facts. */
  const insertReadyVersion = async (
    ctx: TenantContext,
    v: NewVersion,
    tx: Executor,
  ): Promise<void> => {
    await scoped(tx, ctx)
      .insertInto("asset_versions", {
        id: v.id,
        asset_id: v.assetId,
        version_number: v.versionNumber,
        status: "ready",
        storage_key: v.storageKey,
        content_type: v.facts.mediaType,
        byte_size: v.facts.byteSize,
        width_px: v.facts.width,
        height_px: v.facts.height,
        checksum_sha256: v.facts.checksumSha256,
      })
      .execute();
  };

  /** Point the asset at its version and move it to `processing` (Phase 3 makes it ready). */
  const activateVersion = async (
    ctx: TenantContext,
    assetId: string,
    versionId: string,
    tx: Executor,
  ): Promise<void> => {
    await scoped(tx, ctx)
      .updateTable("assets")
      .set({ current_version_id: versionId, status: "processing" })
      .where("id", "=", assetId)
      .execute();
  };

  return { findById, insertAsset, insertReadyVersion, activateVersion };
};
