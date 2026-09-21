# 02 - Service Boundaries

> Category: **Architecture** (`docs/ARCHITECTURE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Name the service boundaries that actually exist in the code, what each one
owns, and how the boundary is enforced. A boundary that is only described is
a suggestion; every boundary below names its enforcement mechanism.

## Category Mandate

Describes the system as a set of components with explicit boundaries. The
platform is storage-agnostic and delivery-agnostic: consumer applications
talk to a stable API contract, never to a storage backend or a processing
engine directly.

---

## Logical services versus deployables

The specification describes eight logical services: API Gateway, Asset
Service, Image Processing Service, Storage Service, CDN, Cache, Queue,
Search. v1 ships them as **two deployables plus libraries** (`ADR-017`):

| Logical service | Where it lives in v1 | Deployable? |
|---|---|---|
| API Gateway | `services/api` -- the edge middleware chain (request id, authentication, tenant context, rate limit) | yes, `api` |
| Asset Service | `services/api` -- `modules/assets`, `uploads`, `folders`, `tags`, `collections`, `versions` | inside `api` |
| Search Service | `services/api` -- `modules/search`, backed by PostgreSQL | inside `api` |
| Image Processing Service | `packages/image-engine` (the pipeline) run by `services/worker` (async) and by `services/api` (the synchronous cheap path, `ADR-015`) | library + `worker` |
| Storage Service | `packages/storage-adapter` -- an in-process library, not a network hop | library |
| Queue | Redis + BullMQ behind `packages/queue` | infrastructure |
| Cache | Redis behind `packages/cache` | infrastructure |
| CDN | External edge in front of `services/api`'s delivery routes | infrastructure |

```
                       +---------------------------+
   consumer apps  ---> |  CDN edge                 |
                       +-------------+-------------+
                                     |
                       +-------------v-------------+          +-----------------+
                       |  services/api             |  enqueue |  services/worker|
                       |   edge middleware         | -------> |   derivatives   |
                       |   management API (/v1)    |          |   size guard    |
                       |   delivery      (/i)      |          |   webhooks      |
                       |   admin API     (/v1/admin)|          |   usage rollup  |
                       +------+------+------+------+          |   sweepers      |
                              |      |      |                 +---+-----+----+--+
                              |      |      +--------------+      |     |    |
                    +---------v-+  +-v-----------+  +-------v------v+  +-v----v--+
                    | PostgreSQL|  | Redis       |  | object storage |  |  (same)  |
                    | (scoped)  |  | cache+queue |  | via adapter    |  |          |
                    +-----------+  +-------------+  +----------------+  +----------+
```

## What each deployable owns

### `services/api`

Every HTTP surface. Stateless: any number of replicas behind a load
balancer, no local disk state, no in-process cache the correctness of which
depends on replica affinity.

- `/v1/...` -- the management API (`docs/API/`)
- `/i/{asset_id}` -- the delivery path (`docs/IMAGE-DELIVERY-PROTOCOL/`)
- `/v1/admin/...` -- the admin API (`docs/API/20-ADMIN-API.md`)
- `/healthz`, `/readyz` -- probes

### `services/worker`

Every queue consumer. Also stateless and horizontally scalable; concurrency
is configuration (`docs/PERFORMANCE/07-CONCURRENCY.md`).

- `generate-derivative` -- the full-effort encode and the AVIF size guard
  (`ADR-015`, `ADR-016`)
- `deliver-webhook` -- signed delivery with retry (`docs/WEBHOOK/`)
- `aggregate-usage` -- metering rollups (`docs/DATABASE/14-USAGE.md`)
- `sweep-pending-uploads`, `purge-deleted-assets` -- scheduled maintenance

## Boundary rules and their enforcement

| Rule | Enforced by |
|---|---|
| `services/*` never import another service's source | `dependency-cruiser` rule `no-service-to-service` |
| `packages/*` never import a service | `dependency-cruiser` rule `no-package-to-service` |
| Only `packages/storage-adapter` imports a storage provider SDK | ESLint `no-restricted-imports` (`ADR-001`) |
| Only `packages/transform-params` hashes transformation parameters | ESLint `no-restricted-imports` on `node:crypto` `createHash` (`ADR-004`) |
| A module never imports another module's repository | ESLint `no-restricted-imports` pattern on `**/*.repository` across module directories |
| Every tenant-owned query goes through `scoped()` | `packages/db` exports; raw builder access restricted by lint (`ADR-005`) |

## Data ownership

v1 has **one PostgreSQL database**. The "each service owns its data"
principle is kept at the *module* level instead of the *database* level:

- each table is owned by exactly one module, named in
  `docs/DATABASE/00-DATA-MODEL.md`;
- only the owning module's repository reads or writes it;
- other modules reach that data through the owning module's service
  functions, never its repository.

`services/worker` imports the same packages and therefore reads through the
same `scoped()` repositories -- it is a second process, not a second data
owner, and every query it makes carries a `TenantContext` built from the
job payload (`docs/ENGINEERING/08-CACHE-QUEUE-STANDARDS.md`).

## Splitting later

The boundary most likely to need its own deployable first is image
processing under load. Because it already runs out of process in
`services/worker` and communicates only through the queue, scaling it
independently is a replica-count change, not a refactor. Promoting any API
module to its own service is mechanical for the same reason: modules share
packages, never repositories.

## Acceptance Criteria

- [x] Every logical service from the specification is mapped to where it
      actually lives, and the deviation from one-service-per-component is
      recorded as `ADR-017`.
- [x] Every boundary rule names a machine-enforced mechanism.
- [x] Data ownership is stated for the single-database reality rather than
      implied from a multi-database ideal.
- [x] Package names match the code: `services/api`, `services/worker`, and
      `packages/{config,errors,logger,db,tenancy,schema,storage-adapter,
      transform-params,queue,cache,image-engine,signing,test-utils}`.

## Open Questions

- The CDN in front of the delivery path is chosen in `P4-01`.
- Whether usage aggregation eventually moves to a separate analytics store
  is a `P7-04` scaling question, not a v1 one.

## Related Documents

- `docs/ARCHITECTURE/01-ARCHITECTURE-PRINCIPLES.md`
- `docs/ARCHITECTURE/03-COMPONENT-ARCHITECTURE.md`
- `docs/ENGINEERING/02-PROJECT-STRUCTURE.md` (the directory layout)
- `docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md` (the enforcement rules)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-004`, `ADR-005`, `ADR-007`, `ADR-017`)
