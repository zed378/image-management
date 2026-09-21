import type { AssetStatus, Visibility } from "@image-delivery/db";

export type AssetVersion = {
  readonly id: string;
  readonly versionNumber: number;
  readonly contentType: string | null;
  readonly byteSize: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly checksumSha256: string | null;
  readonly createdAt: Date;
};

export type Asset = {
  readonly id: string;
  readonly projectId: string;
  readonly folderId: string | null;
  readonly originalFilename: string;
  readonly status: AssetStatus;
  readonly visibility: Visibility;
  readonly altText: string | null;
  readonly description: string | null;
  readonly currentVersion: AssetVersion | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type AssetWire = {
  readonly id: string;
  readonly project_id: string;
  readonly folder_id: string | null;
  readonly original_filename: string;
  readonly status: AssetStatus;
  readonly visibility: Visibility;
  readonly alt_text: string | null;
  readonly description: string | null;
  readonly current_version: {
    readonly id: string;
    readonly version: number;
    readonly content_type: string | null;
    readonly byte_size: number | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly checksum_sha256: string | null;
    readonly created_at: string;
  } | null;
  readonly created_at: string;
  readonly updated_at: string;
};
