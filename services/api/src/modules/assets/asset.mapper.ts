import type { Asset, AssetWire } from "./asset.types";

export const toAssetWire = (asset: Asset): AssetWire => ({
  id: asset.id,
  project_id: asset.projectId,
  folder_id: asset.folderId,
  original_filename: asset.originalFilename,
  status: asset.status,
  visibility: asset.visibility,
  alt_text: asset.altText,
  description: asset.description,
  current_version: asset.currentVersion
    ? {
        id: asset.currentVersion.id,
        version: asset.currentVersion.versionNumber,
        content_type: asset.currentVersion.contentType,
        byte_size: asset.currentVersion.byteSize,
        width: asset.currentVersion.width,
        height: asset.currentVersion.height,
        checksum_sha256: asset.currentVersion.checksumSha256,
        created_at: asset.currentVersion.createdAt.toISOString(),
      }
    : null,
  created_at: asset.createdAt.toISOString(),
  updated_at: asset.updatedAt.toISOString(),
});
