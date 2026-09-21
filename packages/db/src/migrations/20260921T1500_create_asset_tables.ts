import { sql, type Kysely } from "kysely";

import { timestampColumns, ulidPrimaryKey, updatedAtTrigger } from "./ddl";

// P1-01: the asset domain -- folders, assets, versions, metadata,
// derivatives, tags, collections. docs/DATABASE/05-11, ADR-022.
//
// Same-project integrity is a constraint (ADR-022 point 2): every
// project-owned table exposes unique (id, project_id, tenant_id), and a
// reference between two project-owned rows is a composite FK over all three
// columns. Linking an asset to another project's folder, tag or collection
// is therefore rejected by the database, not merely by a service check.
//
// ON DELETE: RESTRICT, except rows with no lifecycle of their own
// (metadata entries, tag links), which CASCADE with their asset. Versions and
// derivatives stay RESTRICT: each has an object in storage, and the purge
// job must delete the object before the row, never lose the pointer to it.

export const up = async (db: Kysely<unknown>): Promise<void> => {
  // ==========================================
  // FOLDERS
  // ==========================================
  await sql`
    create table folders (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      parent_id char(26),
      name citext not null check (
        length(name) between 1 and 128
        and name = btrim(name)
        and position('/' in name) = 0
        and name !~ '[[:cntrl:]]'
      ),
      -- Materialized: '/' || ancestors' names || name. Unique among live folders.
      path citext not null check (path ~ '^/' and length(path) <= 2100),
      depth smallint not null check (depth between 1 and 16),
      ${timestampColumns()},
      constraint folders_root_depth_ck check ((parent_id is null) = (depth = 1)),
      constraint folders_project_fk foreign key (project_id, tenant_id)
        references projects (id, tenant_id) on delete restrict,
      constraint folders_id_project_tenant_uk unique (id, project_id, tenant_id),
      constraint folders_parent_fk foreign key (parent_id, project_id, tenant_id)
        references folders (id, project_id, tenant_id) on delete restrict
    )
  `.execute(db);
  // Serves: resolve a folder by path; enforces one live folder per path.
  await sql`
    create unique index folders_path_uk on folders (tenant_id, project_id, path)
      where deleted_at is null
  `.execute(db);
  // Serves: list a folder's children; the parent FK's restrict check.
  await sql`create index folders_parent_idx on folders (tenant_id, project_id, parent_id)`.execute(
    db,
  );
  await updatedAtTrigger("folders").execute(db);

  // ==========================================
  // ASSETS
  // ==========================================
  await sql`
    create table assets (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      folder_id char(26),
      -- Set once the first version is stored; see assets_current_version_fk.
      current_version_id char(26),
      -- Untrusted display text only: never a path, key or header (SEC-UPL-06).
      original_filename text not null check (length(original_filename) between 1 and 255),
      status text not null default 'pending'
        check (status in ('pending', 'processing', 'ready', 'failed')),
      visibility text not null default 'private'
        check (visibility in ('private', 'public', 'unlisted', 'signed', 'expiring')),
      alt_text text check (length(alt_text) <= 1000),
      description text check (length(description) <= 5000),
      ${timestampColumns()},
      constraint assets_project_fk foreign key (project_id, tenant_id)
        references projects (id, tenant_id) on delete restrict,
      constraint assets_folder_fk foreign key (folder_id, project_id, tenant_id)
        references folders (id, project_id, tenant_id) on delete restrict,
      constraint assets_id_project_tenant_uk unique (id, project_id, tenant_id)
    )
  `.execute(db);
  // Serves: the default listing, newest first, with the ULID as the stable
  // tie-breaker for cursor pagination (docs/API, P6-02).
  await sql`
    create index assets_listing_idx on assets (tenant_id, project_id, created_at desc, id desc)
      where deleted_at is null
  `.execute(db);
  // Serves: list one folder; the folder FK's restrict check (so not partial).
  await sql`
    create index assets_folder_idx on assets (tenant_id, project_id, folder_id, created_at desc)
  `.execute(db);
  // Serves: purge-deleted-assets (rows past the retention window).
  await sql`create index assets_deleted_idx on assets (deleted_at) where deleted_at is not null`.execute(
    db,
  );
  // Serves: sweep-pending-uploads (uploads that never completed).
  await sql`create index assets_pending_idx on assets (created_at) where status = 'pending'`.execute(
    db,
  );
  await updatedAtTrigger("assets").execute(db);

  // ==========================================
  // ASSET VERSIONS
  // ==========================================
  await sql`
    create table asset_versions (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      asset_id char(26) not null,
      version_number integer not null check (version_number >= 1),
      status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
      -- Stored, not derived, so a later key-scheme change never orphans an object.
      storage_key text not null unique check (length(storage_key) between 1 and 1024),
      content_type text check (content_type ~ '^image/[a-z0-9.+-]+$'),
      byte_size bigint check (byte_size > 0),
      width_px integer check (width_px > 0),
      height_px integer check (height_px > 0),
      checksum_sha256 char(64) check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
      -- Normalized focus, [0,1] x [0,1], origin top-left (IDP/09).
      focal_x double precision check (focal_x between 0 and 1),
      focal_y double precision check (focal_y between 0 and 1),
      ${timestampColumns()},
      constraint asset_versions_focal_ck check ((focal_x is null) = (focal_y is null)),
      -- A ready version has every bytes-derived fact; a pending one may not yet.
      constraint asset_versions_ready_ck check (
        status <> 'ready' or (
          content_type is not null and byte_size is not null and width_px is not null
          and height_px is not null and checksum_sha256 is not null
        )
      ),
      constraint asset_versions_asset_fk foreign key (asset_id, project_id, tenant_id)
        references assets (id, project_id, tenant_id) on delete restrict,
      constraint asset_versions_number_uk unique (asset_id, version_number),
      constraint asset_versions_id_project_tenant_uk unique (id, project_id, tenant_id),
      -- Target for assets.current_version_id: the pointer names *this* asset's version.
      constraint asset_versions_id_asset_uk unique (id, asset_id, project_id, tenant_id)
    )
  `.execute(db);
  await updatedAtTrigger("asset_versions").execute(db);

  await sql`
    alter table assets add constraint assets_current_version_fk
      foreign key (current_version_id, id, project_id, tenant_id)
      references asset_versions (id, asset_id, project_id, tenant_id) on delete restrict
  `.execute(db);

  // ==========================================
  // ASSET METADATA
  // ==========================================
  await sql`
    create table asset_metadata (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      asset_id char(26) not null,
      source text not null default 'user' check (source in ('user', 'extracted')),
      key text not null check (key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'),
      value text not null check (octet_length(value) <= 2048),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint asset_metadata_asset_fk foreign key (asset_id, project_id, tenant_id)
        references assets (id, project_id, tenant_id) on delete cascade,
      constraint asset_metadata_key_uk unique (asset_id, source, key)
    )
  `.execute(db);
  await updatedAtTrigger("asset_metadata").execute(db);

  // ==========================================
  // IMAGE DERIVATIVES
  // ==========================================
  await sql`
    create table image_derivatives (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      asset_version_id char(26) not null,
      -- Function and encoding are P3-02's (ADR-004); the column bounds the shape.
      params_hash text not null check (params_hash ~ '^[0-9a-f]{16,128}$'),
      -- The canonical serialization that was hashed, for invalidation and debugging.
      canonical_params text not null check (length(canonical_params) between 1 and 2048),
      format text not null check (format in ('avif', 'webp', 'jpeg', 'png')),
      status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
      storage_key text not null unique check (length(storage_key) between 1 and 1024),
      byte_size bigint check (byte_size > 0),
      width_px integer check (width_px > 0),
      height_px integer check (height_px > 0),
      -- ADR-015/016: why an f=auto request did not get AVIF, persisted per derivative.
      avif_state text check (avif_state in ('pending', 'unavailable', 'not_beneficial')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint image_derivatives_ready_ck check (
        status <> 'ready' or (byte_size is not null and width_px is not null and height_px is not null)
      ),
      constraint image_derivatives_version_fk foreign key (asset_version_id, project_id, tenant_id)
        references asset_versions (id, project_id, tenant_id) on delete restrict
    )
  `.execute(db);
  // Derivative identity (ADR-004, ADR-022 point 9): one row per (version, params).
  // Serves the delivery lookup and the version FK's restrict check.
  await sql`
    create unique index image_derivatives_identity_uk
      on image_derivatives (tenant_id, project_id, asset_version_id, params_hash)
  `.execute(db);
  await updatedAtTrigger("image_derivatives").execute(db);

  // ==========================================
  // TAGS
  // ==========================================
  await sql`
    create table tags (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      -- Case-insensitive (citext) and trimmed: "Beach" and "beach " are one tag.
      name citext not null check (
        length(name) between 1 and 64 and name = btrim(name) and name !~ '[[:cntrl:]]'
      ),
      ${timestampColumns()},
      constraint tags_project_fk foreign key (project_id, tenant_id)
        references projects (id, tenant_id) on delete restrict,
      constraint tags_id_project_tenant_uk unique (id, project_id, tenant_id)
    )
  `.execute(db);
  // Serves: find-or-create a tag by name; one live tag per name per project.
  await sql`
    create unique index tags_name_uk on tags (tenant_id, project_id, name) where deleted_at is null
  `.execute(db);
  await updatedAtTrigger("tags").execute(db);

  await sql`
    create table asset_tags (
      tenant_id char(26) not null,
      project_id char(26) not null,
      asset_id char(26) not null,
      tag_id char(26) not null,
      created_at timestamptz not null default now(),
      primary key (asset_id, tag_id),
      constraint asset_tags_asset_fk foreign key (asset_id, project_id, tenant_id)
        references assets (id, project_id, tenant_id) on delete cascade,
      constraint asset_tags_tag_fk foreign key (tag_id, project_id, tenant_id)
        references tags (id, project_id, tenant_id) on delete cascade
    )
  `.execute(db);
  // Serves: the `tag` filter (assets carrying a tag); the tag FK's cascade.
  await sql`
    create index asset_tags_tag_idx on asset_tags (tenant_id, project_id, tag_id, asset_id)
  `.execute(db);

  // ==========================================
  // COLLECTIONS
  // ==========================================
  await sql`
    create table collections (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      project_id char(26) not null,
      name citext not null check (length(name) between 1 and 200 and name = btrim(name)),
      description text check (length(description) <= 5000),
      ${timestampColumns()},
      constraint collections_project_fk foreign key (project_id, tenant_id)
        references projects (id, tenant_id) on delete restrict,
      constraint collections_id_project_tenant_uk unique (id, project_id, tenant_id)
    )
  `.execute(db);
  // Serves: resolve by name; one live collection per name per project.
  await sql`
    create unique index collections_name_uk on collections (tenant_id, project_id, name)
      where deleted_at is null
  `.execute(db);
  await updatedAtTrigger("collections").execute(db);

  await sql`
    create table collection_assets (
      tenant_id char(26) not null,
      project_id char(26) not null,
      collection_id char(26) not null,
      asset_id char(26) not null,
      position integer not null check (position >= 0),
      created_at timestamptz not null default now(),
      primary key (collection_id, asset_id),
      constraint collection_assets_collection_fk foreign key (collection_id, project_id, tenant_id)
        references collections (id, project_id, tenant_id) on delete cascade,
      -- RESTRICT: an asset in a collection cannot be purged (PLAN/06); the
      -- purge job removes memberships deliberately first.
      constraint collection_assets_asset_fk foreign key (asset_id, project_id, tenant_id)
        references assets (id, project_id, tenant_id) on delete restrict
    )
  `.execute(db);
  // Serves: list a collection in order.
  await sql`
    create index collection_assets_order_idx
      on collection_assets (tenant_id, project_id, collection_id, position)
  `.execute(db);
  // Serves: "collections containing this asset"; the asset FK's restrict check.
  await sql`
    create index collection_assets_asset_idx on collection_assets (asset_id, project_id, tenant_id)
  `.execute(db);
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`drop table collection_assets`.execute(db);
  await sql`drop table collections`.execute(db);
  await sql`drop table asset_tags`.execute(db);
  await sql`drop table tags`.execute(db);
  await sql`drop table image_derivatives`.execute(db);
  await sql`drop table asset_metadata`.execute(db);
  await sql`alter table assets drop constraint assets_current_version_fk`.execute(db);
  await sql`drop table asset_versions`.execute(db);
  await sql`drop table assets`.execute(db);
  await sql`drop table folders`.execute(db);
};
