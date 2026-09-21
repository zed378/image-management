import { AppError } from "@image-delivery/errors";
import { inspectImage } from "@image-delivery/image-engine";
import { newId } from "@image-delivery/schema";
import {
  originalObjectKey,
  StorageUnavailableError,
  type StorageAdapter,
} from "@image-delivery/storage-adapter";

import { createAssetRepository } from "./asset.repository";
import { createFolderRepository } from "../folders/folder.repository";

import type { Asset } from "./asset.types";
import type { Db, Visibility } from "@image-delivery/db";
import type { TenantContext } from "@image-delivery/tenancy";

// Asset creation and reads (docs/API/11-UPLOAD-API.md, docs/ASSET/02, P2-02).
// The upload path: validate the bytes (inspectImage: size, magic bytes,
// header dimensions -- nothing decoded), then in one transaction insert the
// asset and its first version, store the original, and point the asset at
// it. A storage failure rolls the rows back; the original is only ever
// referenced by a committed row.

export type UploadInput = {
  readonly file: Buffer;
  /** The client's filename: display only (SEC-UPL-06). */
  readonly filename: string | undefined;
  readonly folderId: string | null;
  readonly visibility: Visibility;
  readonly altText: string | null;
  readonly description: string | null;
};

const FALLBACK_FILENAME = "upload";

/** Keep a filename for display: printable, trimmed, at most 255 characters. */
export const displayFilename = (raw: string | undefined): string => {
  const cleaned = (raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim()
    .slice(0, 255);
  return cleaned === "" ? FALLBACK_FILENAME : cleaned;
};

export const createAssetService = (deps: { readonly db: Db; readonly storage: StorageAdapter }) => {
  const assets = createAssetRepository(deps.db);
  const folders = createFolderRepository(deps.db);

  const get = async (ctx: TenantContext, assetId: string): Promise<Asset> => {
    const asset = await assets.findById(ctx, assetId);
    // Absent, deleted and another tenant's are one answer (SEC-TEN-03).
    if (!asset) throw new AppError("asset_not_found");
    return asset;
  };

  const upload = async (ctx: TenantContext, input: UploadInput): Promise<Asset> => {
    // Before any row or object exists.
    const facts = await inspectImage(input.file);
    if (input.folderId !== null && !(await folders.exists(ctx, input.folderId))) {
      throw new AppError("folder_not_found");
    }

    const assetId = newId();
    const versionId = newId();
    const storageKey = originalObjectKey({
      tenantId: ctx.tenantId,
      projectId: ctx.projectId ?? "",
      assetId,
      versionId,
      mediaType: facts.mediaType,
    });

    return deps.db.transaction().execute(async (tx) => {
      await assets.insertAsset(
        ctx,
        {
          id: assetId,
          folderId: input.folderId,
          originalFilename: displayFilename(input.filename),
          visibility: input.visibility,
          altText: input.altText,
          description: input.description,
        },
        tx,
      );
      await assets.insertReadyVersion(
        ctx,
        { id: versionId, assetId, versionNumber: 1, storageKey, facts },
        tx,
      );
      try {
        await deps.storage.put(storageKey, input.file, { contentType: facts.mediaType });
      } catch (err) {
        if (err instanceof StorageUnavailableError)
          throw new AppError("storage_unavailable", { cause: err });
        throw err;
      }
      await assets.activateVersion(ctx, assetId, versionId, tx);
      const created = await assets.findById(ctx, assetId, tx);
      if (!created) throw new Error("upload: the asset vanished inside its own transaction");
      return created;
    });
  };

  return { get, upload };
};

export type AssetService = ReturnType<typeof createAssetService>;
