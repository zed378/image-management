# Documentation -- Image Management & Delivery Platform

This is the specification for an **Image Infrastructure API**: a platform other
applications call over HTTP to upload, store, transform, and deliver images,
without ever knowing (or needing to know) what object storage backend sits
underneath.

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

Core promise: `Asset Storage != Image Processing != Image Delivery != Consumer
Application`. Each is a separate, swappable service behind a stable API
contract. See `docs/ARCHITECTURE/00-SYSTEM-ARCHITECTURE.md` for the full diagram.

## How to use this documentation

- **If you are a human or an AI agent about to implement something**, do not
  start writing code from a document alone. Start from `TASKS/PROGRESS.md`,
  find the task, and read the specific documents it names under "Implements".
- **If you are deciding something not yet written down**, write it into the
  relevant document *first*, in the same change as the code, and record the
  decision in `MEMORY/DECISIONS.md` if it was a real fork in the road.
- Every document in this tree follows the same shape: Purpose, Category
  Mandate, Key Topics To Specify, a worked example where one exists,
  Acceptance Criteria, Open Questions, Related Documents. Documents marked
  "Draft specification" are scaffolds -- they name what must be decided, not
  a final decision. Fill them in as the corresponding TASKS/ task is done, and
  flip the status line to "Final" in that same change.

## Categories

| Folder | Covers |
|---|---|
| `PLAN/` | Product intent: requirements, scope, business rules, roadmap. The source of truth everything else implements. |
| `ARCHITECTURE/` | Services, boundaries, and how they fit together. |
| `API/` | The versioned HTTP contract -- the platform's actual product. |
| `IMAGE-DELIVERY-PROTOCOL/` | **The platform's primary contract**, on equal footing with `API/`: canonical URL format, every transformation parameter, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics. `API/` governs how an asset is *managed*; this category governs how an asset is *consumed*. |
| `IMAGE-PROCESSING/` | The deterministic transformation pipeline's implementation (the engine `IMAGE-DELIVERY-PROTOCOL/16-TRANSFORMATION-PIPELINE.md` is a contract for). |
| `STORAGE/` | The storage abstraction and object lifecycle. |
| `DATABASE/` | The relational data model. |
| `ASSET/` | The asset resource and its lifecycle. |
| `MULTI-TENANCY/` | Tenant isolation as a first-class requirement. |
| `SECURITY/` | AuthN/AuthZ, threat model, IDOR/BOLA, abuse prevention. |
| `CDN/` | Cache keys, TTLs, invalidation, edge delivery. |
| `SEARCH/` | Filtering, sorting, and asset discovery. |
| `SDK/` | Client libraries and the client-side `<Image/>` pattern. |
| `WEBHOOK/` | Asynchronous event delivery. |
| `OBSERVABILITY/` | Logging, metrics, tracing, SLOs, alerting. |
| `PERFORMANCE/` | Numeric performance requirements and load testing. |
| `DEVOPS/` | Environments, CI/CD, migrations, backup/restore, DR. |
| `TESTING/` | Test strategy across every layer. |
| `UI-UX/` | The developer/admin dashboard. |
| `DEVELOPER/` | Getting-started and task-oriented developer docs. |
| `WEBSITE/` | **The public web presence**: competitive landscape, positioning, the landing page's structure and full copy, visual direction (including how not to look machine-assembled), asset licensing, the documentation site's IA and content plan, performance/SEO/accessibility budgets, and the launch checklist. |
| `ENGINEERING/` | **How code in this repository is written**: project structure, naming, layering, templates per layer, error/response shapes, tenant-scoping rules, testing conventions, lint enforcement, and the review checklist. Start with `ENGINEERING/00-CODING-CONTEXT.md`. |

318 documents total. See each category's own `README.md` for its file list.

## One architectural decision that shapes everything else

`Asset Storage != Image Processing != Image Delivery != Consumer Application.`

```
                 +----------------------+
                 | Consumer Application |
                 +-----------+----------+
                             | API
                             v
                 +----------------------+
                 | Image Platform API   |
                 +-----------+----------+
                             |
             +----------------+----------------+
             v                v                v
        Asset Manager   Image Engine       Metadata
             |                |
             v                v
        Object Storage   Derivatives
                              |
                              v
                            CDN
                              |
                              v
                           Client
```
