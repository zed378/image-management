# Progress Board

Live status board for every task in `TASKS/`. Update this file in the same
commit/PR that closes a task (see `TASKS/00-TASK-CONVENTIONS.md`).

Status values: `Not started` / `In progress` / `Blocked (<reason>)` / `Done`.

**Total: 78 tasks across 8 phases. Current phase: Phase 0 -- Foundation.**

## Phase 0 -- Foundation

Detail: [`TASKS/PHASE-0-FOUNDATION.md`](./PHASE-0-FOUNDATION.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P0-01 | Repository & workspace scaffolding | Done | `feat/P0-01-workspace-scaffolding` | ff-merge | [record](../MEMORY/records/P0-01.md) |
| P0-02 | Local infrastructure via Docker Compose | Done | `feat/P0-02-local-infrastructure` | ff-merge | [record](../MEMORY/records/P0-02.md) |
| P0-03 | CI pipeline | Done | `feat/P0-03-ci-pipeline` | squash | [record](../MEMORY/records/P0-03.md) |
| P0-04 | Structured configuration & secrets loading | Done | `feat/P0-04-configuration` | squash | [record](../MEMORY/records/P0-04.md) |
| P0-05 | Structured logging & base observability scaffold | Done | `feat/P0-05-logging-tracing` | squash | [record](../MEMORY/records/P0-05.md) |
| P0-06 | Core database schema -- tenancy chain | Done | `feat/P0-06-tenancy-schema` | squash | [record](../MEMORY/records/P0-06.md) |
| P0-07 | Storage abstraction interface + provider adapters | Done | `feat/P0-07-storage-adapters` | squash | [record](../MEMORY/records/P0-07.md) |
| P0-08 | API Gateway skeleton + health check | Done | `feat/P0-08-api-gateway` | squash | [record](../MEMORY/records/P0-08.md) |
| P0-09 | Error handling & standard error envelope | Done | `feat/P0-09-error-handling` | squash | [record](../MEMORY/records/P0-09.md) |
| P0-10 | Base CI security scan + dependency audit | Done | `feat/P0-10-security-scan` | squash | [record](../MEMORY/records/P0-10.md) |
| P0-11 | Enforce the engineering conventions in tooling | Done | `feat/P0-11-tooling-enforcement` | squash | [record](../MEMORY/records/P0-11.md) |

## Phase 1 -- Multi-Tenancy, Data Model & Authentication

Detail: [`TASKS/PHASE-1-TENANCY-AUTH.md`](./PHASE-1-TENANCY-AUTH.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P1-01 | Full data model migrations | Done | `feat/P1-01-data-model` | squash | [record](../MEMORY/records/P1-01.md) |
| P1-02 | API key issuance & hashed storage | Done | `feat/P1-02-api-keys` | squash | [record](../MEMORY/records/P1-02.md) |
| P1-03 | Authentication middleware | Done | `feat/P1-03-auth-middleware` | squash | [record](../MEMORY/records/P1-03.md) |
| P1-04 | RBAC roles & permission checks | Done | `feat/P1-04-rbac` | squash | [record](../MEMORY/records/P1-04.md) |
| P1-05 | Tenant isolation enforcement at the query layer | Done | `feat/P1-05-tenant-isolation` | squash | [record](../MEMORY/records/P1-05.md) |
| P1-06 | IDOR/BOLA test suite as a CI gate | Done | `feat/P1-06-idor-gate` | squash | [record](../MEMORY/records/P1-06.md) |
| P1-07 | Audit logging | Not started | - | - | - |
| P1-08 | Quota & usage tables wired (metering scaffold, no enforcement yet) | Not started | - | - | - |

## Phase 2 -- Asset Management & Storage

Detail: [`TASKS/PHASE-2-ASSET-STORAGE.md`](./PHASE-2-ASSET-STORAGE.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P2-01 | Object naming & bucket layout | Not started | - | - | - |
| P2-02 | Asset upload -- direct multipart | Not started | - | - | - |
| P2-03 | Asset upload -- presigned direct-to-storage | Not started | - | - | - |
| P2-04 | Upload from remote URL | Not started | - | - | - |
| P2-05 | Asset versioning | Not started | - | - | - |
| P2-06 | Metadata, tags, folders, collections CRUD | Not started | - | - | - |
| P2-07 | Asset duplication | Not started | - | - | - |
| P2-08 | Asset deletion -- soft delete | Not started | - | - | - |
| P2-09 | Asset restoration | Not started | - | - | - |
| P2-10 | Bulk operations | Not started | - | - | - |
| P2-11 | Storage lifecycle, backup & restore procedure | Not started | - | - | - |

## Phase 3 -- Image Processing & Transformation API

Detail: [`TASKS/PHASE-3-PROCESSING-TRANSFORMATION.md`](./PHASE-3-PROCESSING-TRANSFORMATION.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P3-01 | Choose and integrate the image processing engine | Not started | - | - | - |
| P3-02 | Transformation parameter parsing & normalization | Not started | - | - | - |
| P3-03 | Resize, fit modes & position/gravity | Not started | - | - | - |
| P3-04 | Focal point & auto-crop | Not started | - | - | - |
| P3-05 | Quality, format conversion & format=auto negotiation | Not started | - | - | - |
| P3-06 | Optimization, metadata stripping & orientation | Not started | - | - | - |
| P3-07 | Thumbnail presets & eager vs. lazy generation | Not started | - | - | - |
| P3-08 | Processing failure handling & the image-delivery-API path | Not started | - | - | - |
| P3-09 | Processing queue, concurrency limits & worker scaling | Not started | - | - | - |
| P3-10 | Canonical URL & transformation-pipeline contract | Not started | - | - | - |

## Phase 4 -- Delivery, CDN & Caching

Detail: [`TASKS/PHASE-4-DELIVERY-CDN.md`](./PHASE-4-DELIVERY-CDN.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P4-01 | CDN selection & edge topology | Not started | - | - | - |
| P4-02 | Cache key strategy | Not started | - | - | - |
| P4-03 | Cache-Control headers & TTL policy | Not started | - | - | - |
| P4-04 | Cache invalidation | Not started | - | - | - |
| P4-05 | Bandwidth optimization & CDN failover | Not started | - | - | - |
| P4-06 | Delivery-path load & correctness testing | Not started | - | - | - |
| P4-07 | HTTP delivery semantics -- HEAD, conditional & range requests | Not started | - | - | - |
| P4-08 | Protocol conformance test suite & reference examples | Not started | - | - | - |

## Phase 5 -- Security Hardening

Detail: [`TASKS/PHASE-5-SECURITY-HARDENING.md`](./PHASE-5-SECURITY-HARDENING.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P5-01 | Asset visibility levels | Not started | - | - | - |
| P5-02 | Signed URL generation & verification | Not started | - | - | - |
| P5-03 | Rate limiting | Not started | - | - | - |
| P5-04 | Malicious file & upload hardening | Not started | - | - | - |
| P5-05 | Abuse prevention | Not started | - | - | - |
| P5-06 | Threat model review against the shipped system | Not started | - | - | - |
| P5-07 | Incident response runbook | Not started | - | - | - |

## Phase 6 -- Search, Webhooks, SDKs & Dashboard

Detail: [`TASKS/PHASE-6-SEARCH-WEBHOOKS-SDK-DASHBOARD.md`](./PHASE-6-SEARCH-WEBHOOKS-SDK-DASHBOARD.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P6-01 | Search & filter API | Not started | - | - | - |
| P6-02 | Cursor-based pagination | Not started | - | - | - |
| P6-03 | Webhook subscription management | Not started | - | - | - |
| P6-04 | Webhook delivery worker + signing + retry | Not started | - | - | - |
| P6-05 | Wire the four core events end to end | Not started | - | - | - |
| P6-06 | TypeScript SDK | Not started | - | - | - |
| P6-07 | React `<Image/>` component + client-side image package | Not started | - | - | - |
| P6-08 | PHP & Go SDKs (minimal, server-side use cases) | Not started | - | - | - |
| P6-09 | Dashboard -- information architecture & auth | Not started | - | - | - |
| P6-10 | Dashboard -- asset manager, upload UX, preview | Not started | - | - | - |
| P6-11 | Dashboard -- API keys, webhooks, usage & settings | Not started | - | - | - |

## Phase 7 -- Observability, Performance & Launch Readiness

Detail: [`TASKS/PHASE-7-OBSERVABILITY-PERFORMANCE-LAUNCH.md`](./PHASE-7-OBSERVABILITY-PERFORMANCE-LAUNCH.md)

| Task | Title | Status | Branch | PR | MEMORY record |
|---|---|---|---|---|---|
| P7-01 | Metrics across every service | Not started | - | - | - |
| P7-02 | SLOs, SLIs & alerting | Not started | - | - | - |
| P7-03 | Distributed tracing completion | Not started | - | - | - |
| P7-04 | Quota enforcement -- turn metering into limits | Not started | - | - | - |
| P7-05 | Load & performance testing against documented targets | Not started | - | - | - |
| P7-06 | Failure-injection & disaster recovery drill | Not started | - | - | - |
| P7-07 | End-to-end test suite covering the full core promise | Not started | - | - | - |
| P7-08 | Developer documentation completion | Not started | - | - | - |
| P7-09 | Launch readiness review | Not started | - | - | - |
| P7-10 | Documentation site | Not started | - | - | - |
| P7-11 | Landing page | Not started | - | - | - |
| P7-12 | Site performance, accessibility & SEO gates | Not started | - | - | - |
