# Image Management & Delivery Platform

An **Image Infrastructure API**: a platform other applications call over
HTTP to upload, store, transform, and deliver images -- without ever
knowing, or needing to know, what object storage backend sits underneath.

```
Consumer App --(API)--> Image Platform --(query params)--> Original Image
                              |
                    resize / crop / position
                    quality / format / DPR
                              |
                              v
                        CDN / Image URL
                              |
                              v
                      Consumer Application
```

A consumer application requests an image by asset ID plus a set of
declarative parameters (`width`, `height`, `fit`, `position`, `quality`,
`format`, `DPR`, ...) and gets back an optimized, cacheable response --
never a storage credential, never a raw object path. Storage, processing,
and delivery are independently swappable behind a stable API contract:

```
Asset Storage != Image Processing != Image Delivery != Consumer Application
```

Fits gallery, e-commerce, CMS, wedding-invitation, social, profile-image,
banner, and thumbnail use cases as a standalone service or embedded inside
another application's infrastructure.

Four independently-owned layers, each swappable without the others noticing:

```
+-----------------------------------------------+
|              CONSUMER APPLICATIONS             |
| Wedding | CMS | E-Commerce | Mobile | ERP      |
+----------------------+--------------------------+
                       | API / Image URL
                       v
+-----------------------------------------------+
|             IMAGE DELIVERY PROTOCOL             |
| URL | Transform | Resize | Crop | Focus        |
| DPR | Format | Cache | Signed URL | CDN        |
+----------------------+--------------------------+
                       v
+-----------------------------------------------+
|             IMAGE PROCESSING ENGINE            |
| Decode -> Transform -> Optimize -> Encode      |
+----------------------+--------------------------+
                       v
+-----------------------------------------------+
|                 ASSET STORAGE                  |
| S3 | MinIO | R2 | GCS | Azure | Local          |
+-----------------------------------------------+
```

`docs/API/` governs how an asset is *managed* (upload, CRUD, metadata).
[`docs/IMAGE-DELIVERY-PROTOCOL/`](./docs/IMAGE-DELIVERY-PROTOCOL/README.md)
governs how an asset is *consumed* -- the wire-level contract an origin, a
CDN edge, and every SDK must all implement identically. The two are equally
important; neither is a subsection of the other.

## Where things are

| Folder | What it holds |
|---|---|
| [`docs/`](./docs/README.md) | **The specification** -- product, architecture, API contract, database schema, the image delivery protocol, image processing, storage, multi-tenancy, security, CDN, search, SDKs, webhooks, observability, performance, DevOps, testing, dashboard UI, developer docs. 293 documents. |
| [`TASKS/`](./TASKS/README.md) | **The execution plan** -- 74 tasks across 8 phases, each naming the documents it implements and how it is judged done. Start at [`TASKS/PROGRESS.md`](./TASKS/PROGRESS.md). |
| [`MEMORY/`](./MEMORY/README.md) | **The record** -- decisions and what was actually built, and why. Decisions live in [`MEMORY/DECISIONS.md`](./MEMORY/DECISIONS.md). |

`AGENTS.md` and `CLAUDE.md` are the operating instructions for anyone --
human or AI agent -- working in this repository. **Read `AGENTS.md` before
starting anything.**

At the point this repository was created, only the specification, plan, and
record scaffolding exist -- no application code yet. `TASKS/PHASE-0-FOUNDATION.md`
is where that starts.

## Recommended stack (see `MEMORY/DECISIONS.md` for the reasoning)

TypeScript on Node.js LTS (pnpm workspaces) &middot; PostgreSQL &middot;
Redis (cache + BullMQ-style queues) &middot; `sharp`/libvips for image
processing &middot; S3-compatible object storage (S3 / Cloudflare R2 /
MinIO via one adapter) &middot; Docker Compose for local infrastructure.

## Working conventions

- One task at a time from `TASKS/`, in dependency order.
- One branch per task, named for its task ID: `feat/P0-01-repo-scaffolding`.
- Commit subject `P{phase}-{seq}: ...` -- the task ID is the join key across
  branches, commits, PRs, `MEMORY/` records, and the progress board.
- A task is not done until its record exists in `MEMORY/records/` and
  `TASKS/PROGRESS.md` is updated in the same commit.
- Every `:id`-scoped endpoint gets an IDOR/BOLA test. `docs/SECURITY/` has
  zero tolerance, given the platform is explicitly multi-tenant.

Full detail: [`TASKS/00-TASK-CONVENTIONS.md`](./TASKS/00-TASK-CONVENTIONS.md).

## Status

Phase 0 -- Foundation, not yet started. See
[`TASKS/PROGRESS.md`](./TASKS/PROGRESS.md) for the live board.
