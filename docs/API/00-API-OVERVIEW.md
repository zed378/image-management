# 00 - API Overview

> Category: **API Contract** (`docs/API/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The map of the platform's HTTP surfaces: what exists, who calls it, how it
authenticates, and where each is specified.

## Category Mandate

The platform is API-first. Every capability exposed to a consumer
application is defined as a versioned, documented HTTP contract before it is
implemented.

---

## Surfaces

All served by `services/api` (`ADR-017`).

| Surface | Path | Caller | Authentication | Specified in |
|---|---|---|---|---|
| Management API | `/v1/...` | consumer applications, SDKs, the dashboard | API key (`Bearer`) | this category |
| Delivery | `/i/{asset_id}?...` | browsers, CDN edges | none for public assets; signature or key otherwise | `docs/IMAGE-DELIVERY-PROTOCOL/` |
| Admin API | `/v1/admin/...` | platform operators | admin credential | `20-ADMIN-API.md` |
| Storage proxy | `/v1/storage/proxy/{token}` | clients holding a presigned URL | the token itself | `docs/STORAGE/01` |
| Probes | `/healthz`, `/readyz` | orchestrators | none | `docs/ARCHITECTURE/04-API-GATEWAY.md` |

The management API manages assets; the delivery protocol consumes them
(`ADR-009`). Where they overlap, the protocol is normative.

## Resource map (v1)

```
/v1/projects/{project_id}/assets                  list, create (upload)
/v1/projects/{project_id}/assets/upload-url       presigned upload
/v1/projects/{project_id}/assets/from-url         import from a URL
/v1/assets/{asset_id}                             read, update, delete
/v1/assets/{asset_id}/versions                    version history
/v1/assets/{asset_id}/restore | /duplicate        lifecycle actions
/v1/projects/{project_id}/folders | /tags | /collections
/v1/assets/bulk-delete | bulk-tag | bulk-move     bulk operations
/v1/projects/{project_id}/search                  search (P6-01)
/v1/applications/{application_id}/api-keys        key management
/v1/applications/{application_id}/webhooks        webhook subscriptions
/v1/usage                                          metering and quotas
```

Each resource is specified in its own document (`10`..`20`) and lands with
its task; a route that is not yet implemented returns `404 route_not_found`.

## Conventions

`01-API-STANDARDS.md` is normative for every surface above except delivery:
the envelope, `snake_case`, RFC 3339 timestamps, ULIDs, the
`X-Request-Id`/`traceparent` headers, and the status-code rules.

## Status as of P0-08

Implemented: probes, the `/v1` prefix, request correlation, the envelope,
and `404 route_not_found` for unknown routes. Every other surface arrives
with the task named in its document.

## Acceptance Criteria

- [x] Every HTTP surface is listed with its caller, authentication, and
      specification.
- [x] The document states which parts are implemented, so a reader cannot
      mistake the map for shipped behaviour.

## Related Documents

- `docs/API/01-API-STANDARDS.md` .. `20-ADMIN-API.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/00-PROTOCOL-OVERVIEW.md`
- `docs/ARCHITECTURE/04-API-GATEWAY.md`
