# 10 - Settings

> Category: **Dashboard UI/UX** (`docs/UI-UX/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify settings for the Image Management & Delivery Platform. Application/project-level configuration: API keys, webhook endpoints, custom CDN domain, default transformation presets, and team member access (RBAC roles).

## Category Mandate

The optional developer/admin dashboard is not the platform's primary consumer -- the API is -- but it is the primary way a human operator manages assets, keys, and usage. These documents define its information architecture and key screens.

## Key Topics To Specify

- Application/project-level configuration: API keys, webhook endpoints, custom CDN domain, default transformation presets, and team member access (RBAC roles).

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/UI-UX/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
