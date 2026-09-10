# Phase 2 -- Asset Management & Storage

Goal: a consumer application can upload an original image and get back a
durable, versioned asset, organized into folders/collections/tags, with
validated content, correct object-storage layout, and full CRUD -- but no
transformation/delivery yet (that's Phase 3).

Exit criteria: `POST /v1/assets` (direct upload) and the presigned-upload
flow both work end to end against the local MinIO adapter; an asset can be
tagged, foldered, versioned, soft-deleted, and restored; every endpoint has
an isolation test per `P1-06`.

---

### P2-01: Object naming & bucket layout

- **Depends on:** P0-07
- **Implements:** `docs/STORAGE/03-BUCKET-STRATEGY.md`, `docs/STORAGE/04-OBJECT-NAMING.md`

**Steps**
1. Implement the key scheme:
   `{tenant_id}/{project_id}/originals/{asset_id}/{version}.{ext}` and
   `{tenant_id}/{project_id}/derivatives/{asset_id}/{params_hash}.{ext}`.
2. Implement the canonical `params_hash`: sort transformation params by
   name, normalize aliases (`w`==`width`), coerce types, hash (e.g.
   SHA-256, truncated) -- unit test that parameter order never changes the
   hash and that every distinct semantic request produces a distinct hash.
3. Decide and document bucket-per-environment vs. per-tenant (default:
   per-environment, isolation via prefix + IAM).

**Definition of Done**
- [ ] `docs/STORAGE/04-OBJECT-NAMING.md` is Final with the exact scheme and
      the `params_hash` algorithm specified precisely enough to reimplement.

---

### P2-02: Asset upload -- direct multipart

- **Depends on:** P1-05, P2-01
- **Implements:** `docs/API/11-UPLOAD-API.md`, `docs/ASSET/02-ASSET-UPLOAD.md`, `docs/IMAGE-PROCESSING/02-IMAGE-VALIDATION.md`

**Steps**
1. `POST /v1/projects/:projectId/assets` (multipart/form-data): validate
   MIME type via magic-byte sniffing (never trust `Content-Type`), enforce
   max file size and max pixel dimensions *before* decoding the image
   (image-bomb protection), reject on failure with a specific `error.code`.
2. On success: create the `assets` + first `asset_versions` row, `PUT` the
   original to storage via the adapter, mark status `processing` (not yet
   `ready` -- Phase 3 flips it once eager derivatives, if any, are done).
3. Support `Idempotency-Key` header per `docs/API/08-IDEMPOTENCY.md`.

**Definition of Done**
- [ ] Uploading a file with a spoofed extension/MIME type is rejected.
- [ ] Uploading an image with absurd declared dimensions is rejected before
      any decode is attempted (tested with a crafted file).
- [ ] Isolation test present per `P1-06`.

---

### P2-03: Asset upload -- presigned direct-to-storage

- **Depends on:** P2-02
- **Implements:** `docs/API/11-UPLOAD-API.md`, `docs/STORAGE/01-STORAGE-ABSTRACTION.md`

**Steps**
1. `POST /v1/projects/:projectId/assets/upload-url`: creates a pending
   asset row, returns a presigned `PUT` URL (via `StorageAdapter.presignPut`)
   scoped to the exact expected object key and a short expiry.
2. Client uploads directly to storage; a completion callback or a
   storage-provider webhook/event (or a client-called `POST .../complete`
   as the v1-simple approach) transitions the asset from `pending` to
   `processing`.
3. Add a sweeper job that expires/cleans up `pending` assets whose upload
   never completed within a timeout.

**Definition of Done**
- [ ] A presigned URL is unusable outside its expiry window and unusable
      for any object key other than the one it was issued for (tested).

---

### P2-04: Upload from remote URL

- **Depends on:** P2-02
- **Implements:** `docs/API/11-UPLOAD-API.md`, `docs/SECURITY/13-UPLOAD-SECURITY.md`

**Steps**
1. `POST /v1/projects/:projectId/assets/from-url`: platform fetches the
   remote image server-side.
2. **SSRF defense is mandatory, not optional**: resolve DNS and reject
   private/loopback/link-local IP ranges before connecting; disallow
   redirects to a different host without re-validating; enforce a fetch
   timeout and max response size.
3. Run the fetched content through the same validation pipeline as a
   direct upload (P2-02) before persisting.

**Definition of Done**
- [ ] A test suite of SSRF attempt vectors (localhost, 169.254.169.254
      cloud metadata endpoint, DNS rebinding, open redirect to internal IP)
      is included and passes.

---

### P2-05: Asset versioning

- **Depends on:** P2-02
- **Implements:** `docs/DATABASE/06-ASSET-VERSIONS.md`, `docs/ASSET/03-ASSET-VERSIONING.md`

**Steps**
1. Re-uploading to an existing asset ID creates a new `asset_versions` row
   and moves the `current_version` pointer; prior versions stay in storage
   per `docs/PLAN/16-RETENTION-POLICY.md`.
2. `GET /v1/assets/:id/versions` lists version history; `POST
   /v1/assets/:id/versions/:versionId/promote` moves the current pointer.
3. Fire `asset.updated` webhook (stub queued here, delivered once
   `WEBHOOK/` lands in Phase 6) on version promotion.

**Definition of Done**
- [ ] Promoting an old version invalidates cached derivatives tied to the
      previous current version (coordinate with `P4` cache invalidation;
      acceptable to stub the invalidation call here and wire it fully in
      Phase 4, but the call site must exist).

---

### P2-06: Metadata, tags, folders, collections CRUD

- **Depends on:** P2-02
- **Implements:** `docs/ASSET/04-ASSET-METADATA.md`, `05-ASSET-TAGS.md`, `06-ASSET-FOLDERS.md`, `07-ASSET-COLLECTIONS.md`

**Steps**
1. `PATCH /v1/assets/:id` for custom metadata (arbitrary key/value, size
   capped) and built-in fields (alt text, description).
2. Tag CRUD + many-to-many attach/detach; folder CRUD (hierarchical, one
   parent) + move; collection CRUD + ordered membership.
3. Every list/detach/move operation re-validates the resource is within the
   caller's project (isolation test per `P1-06`).

**Definition of Done**
- [ ] Moving an asset into a folder that belongs to a different project is
      rejected, tested explicitly (this is a cross-*resource*, same-tenant
      IDOR variant worth its own test, not just cross-tenant).

---

### P2-07: Asset duplication

- **Depends on:** P2-06
- **Implements:** `docs/ASSET/08-ASSET-DUPLICATION.md`

**Steps**
1. `POST /v1/assets/:id/duplicate`: default behavior copies the object in
   storage and creates an independent new asset (safe default -- the
   duplicate can be deleted without affecting the original).
2. Document (and only implement if actually needed for v1) an
   alias/reference mode as a possible future optimization, explicitly
   marked out of scope if not built now.

**Definition of Done**
- [ ] Deleting the original asset after duplication does not affect the
      duplicate (tested).

---

### P2-08: Asset deletion -- soft delete

- **Depends on:** P2-06
- **Implements:** `docs/ASSET/09-ASSET-DELETION.md`, `docs/PLAN/16-RETENTION-POLICY.md`

**Steps**
1. `DELETE /v1/assets/:id` sets `status=deleted`, `deleted_at=now()`;
   object stays in storage; asset disappears from default list/search
   results and from delivery (see `docs/API/14-IMAGE-DELIVERY-API.md`,
   returns `404` once deleted, even with a previously-valid signed URL --
   confirm and cross-reference `docs/SECURITY/12-SIGNED-URL.md`).
2. A scheduled job hard-deletes (purges storage objects + DB rows) once the
   retention window from `docs/PLAN/16-RETENTION-POLICY.md` elapses.

**Definition of Done**
- [ ] A previously-issued signed URL for a now-soft-deleted asset returns
      `404`, tested.

---

### P2-09: Asset restoration

- **Depends on:** P2-08
- **Implements:** `docs/ASSET/10-ASSET-RESTORATION.md`

**Steps**
1. `POST /v1/assets/:id/restore` within the retention window, guarded by
   `asset:restore` permission (RBAC).
2. Note whether purged/evicted derivatives are regenerated eagerly or
   lazily on restore (default: lazily, same as any cache miss).

**Definition of Done**
- [ ] Restoring after the retention window has elapsed (object already
      purged) returns a clear, specific error, not a generic 500.

---

### P2-10: Bulk operations

- **Depends on:** P2-06, P2-08
- **Implements:** `docs/API/18-BULK-API.md`

**Steps**
1. `POST /v1/assets/bulk-delete`, `bulk-tag`, `bulk-move`: define and
   implement as best-effort-per-item (not all-or-nothing), returning a
   per-item result array so a client can see exactly which of 500 items
   failed and why.
2. Cap batch size; reject oversized batches with a specific error code
   rather than timing out.

**Definition of Done**
- [ ] A batch with one invalid ID among many valid ones processes the valid
      ones and reports the one failure, verified by test.

---

### P2-11: Storage lifecycle, backup & restore procedure

- **Depends on:** P0-07, P2-08
- **Implements:** `docs/STORAGE/05-STORAGE-LIFECYCLE.md`, `07-STORAGE-BACKUP.md`, `08-STORAGE-RESTORE.md`, `docs/DEVOPS/07-BACKUP.md`, `08-RESTORE.md`

**Steps**
1. Configure provider-level lifecycle rules for soft-deleted objects past
   retention (transition to cheaper storage class before hard purge, if the
   provider supports it and it's cost-effective).
2. Set up scheduled backups of the metadata database (originals in object
   storage are the durability boundary for asset bytes; the DB backup
   covers everything referencing them).
3. Run and document one full restore drill against a non-production
   environment; record the actual time taken against the RTO target in
   `docs/DEVOPS/08-RESTORE.md`.

**Definition of Done**
- [ ] The restore drill actually happened (not just described) and its
      result is recorded in `MEMORY/records/P2-11.md`.

---
