# 04 - Object Naming

> Category: **Storage** (`docs/STORAGE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How every object in storage is named: originals (immutable, one per asset
version) and derivatives (a regenerable cache, safe to evict). Specified
precisely enough to reimplement, including the `params_hash` algorithm.

## Category Mandate

Storage is abstracted behind an internal interface so the object storage
provider can be swapped without any consumer-facing change. These documents
define that abstraction, bucket and object-naming strategy, lifecycle,
replication, backup, and cost control.

---

## The key scheme

```
originals:    {tenant_id}/{project_id}/originals/{asset_id}/{version_id}.{ext}
derivatives:  {tenant_id}/{project_id}/derivatives/{asset_id}/{version_id}/{params_hash}.{ext}
```

- Every segment is a platform-generated ULID or `params_hash` -- **never**
  caller input: not a filename, not a path (`SEC-UPL-06`). A non-ULID or
  non-hex segment is refused at key construction.
- The first two segments are the tenant and project, so a prefix is an
  isolation boundary and a per-tenant purge is a prefix delete
  (`SEC-TEN-05`).
- `version_id` (the version's ULID) rather than a version number: immutable,
  unique, and the same value the `asset_versions` row carries (ADR-022).
- Derivatives sit under their version, so invalidating a version's
  derivatives is one prefix (`derivativePrefix`, `IDP/17`).
- `ext` is cosmetic (the stored `Content-Type` is authoritative):
  `image/jpeg`->`jpg`, `png`, `webp`, `avif`, `gif`, `image/tiff`->`tif`,
  `heic`, `heif`; derivatives by output format `avif`, `webp`, `jpg`, `png`.
- The key is **stored** on its row (`asset_versions.storage_key`,
  `image_derivatives.storage_key`) and read from there; a later scheme
  change never orphans an object.
- Keys also satisfy the adapter grammar (`packages/storage-adapter/src/keys.ts`):
  at most 1024 characters, segments `[A-Za-z0-9_=-][A-Za-z0-9._=-]*`.

Implementation: `originalObjectKey`, `derivativeObjectKey`,
`derivativePrefix` in `packages/storage-adapter/src/object-keys.ts`.

## `params_hash`

1. **Canonicalize** the transformation query with
   `canonicalize(query, context)` in `packages/transform-params` -- the
   14-step algorithm of `docs/IMAGE-DELIVERY-PROTOCOL/03`: parse (last
   duplicate wins), partition known / near-miss / foreign, resolve aliases,
   coerce and validate, apply the interaction rules, resolve every `auto`
   to a concrete value (Accept bucket, quality table, EXIF orientation,
   gravity rectangle), insert effective defaults, snap if the project uses
   the ladder, check the pixel budget, sort keys (ASCII), serialize as
   `k=v` joined by `&`.
2. **Hash**:

   ```
   params_hash = lowercase_hex( SHA-256( "idp1" + "|" + TABLES_VERSION + "|" + canonical ) )[0:32]
   ```

   `TABLES_VERSION` is `q{quality}.l{ladder}.e{effects}.f{formats}`
   (currently `q1.l1.e1.f1`); any change to a versioned table bumps its
   number and so changes every dependent hash (ADR-014, ADR-023).

Delivery parameters (`dl`, `exp`, `sig`) are not part of the canonical
transformation and never affect `params_hash` -- they change headers or
authorization, not bytes.

Example (source 4000x3000, `Accept: image/avif,...`):

```
query:      width=800&height=600&fit=crop&position=center&quality=80&format=auto&utm_source=x
canonical:  dpr=1&f=avif&fit=cover&g=center&h=600&q=80&w=800
hash input: idp1|q1.l1.e1.f1|dpr=1&f=avif&fit=cover&g=center&h=600&q=80&w=800
params_hash: 8307391ea584357bf6f8f2f6834fda8e
key:        {tenant}/{project}/derivatives/{asset}/{version}/8307391ea584357bf6f8f2f6834fda8e.avif
```

The golden vectors (`packages/transform-params/fixtures/golden-vectors.json`)
are append-only and pin this function across releases; the equivalence
guarantee (parameter order, aliases, dialects, duplicates, foreign
parameters never change the hash) is tested in
`packages/transform-params/src/canonicalize.test.ts`.

## Acceptance Criteria

- [x] Every default and every rule is stated; nothing is left to a library.
- [x] Every rule is tested (`object-keys.test.ts`, `canonicalize.test.ts`,
      `golden-vectors.test.ts`).
- [x] Cross-references: `STORAGE/03`, `IDP/03`, `IDP/04`, `IDP/17`,
      `DATABASE/06`, `DATABASE/08`.

## Related Documents

- `docs/STORAGE/03-BUCKET-STRATEGY.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md`, `04-TRANSFORMATION-PARAMETERS.md`, `17-DERIVATIVE-IDENTITY.md`
- `docs/DATABASE/06-ASSET-VERSIONS.md`, `08-IMAGE-DERIVATIVES.md`
- `MEMORY/DECISIONS.md` (`ADR-004`, `ADR-014`, `ADR-022`, `ADR-023`)
