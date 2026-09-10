# 00 - Search Architecture

> Category: **Search & Query** (`docs/SEARCH/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify search architecture for the Image Management & Delivery Platform. Defines how consumer applications discover and filter assets by metadata, tags, folder, collection, and derived image properties, with predictable pagination and sorting semantics across all list endpoints..

## Category Mandate

Defines how consumer applications discover and filter assets by metadata, tags, folder, collection, and derived image properties, with predictable pagination and sorting semantics across all list endpoints.

## Key Topics To Specify

- Define the concrete rules for search architecture -- concepts alone are not sufficient; every rule must be specific enough to write a test against.
- State explicit defaults for every configurable value related to search architecture.
- Note every place in the codebase / other documents that must stay consistent with this document if it changes.

## Reference Example

```
GET /api/assets?
    folder=wedding&
    tag=bride&
    width_min=1000&
    format=jpeg
```
Every filterable field above must be backed by an index; a field that is not
indexed is either not offered as a filter or is explicitly documented as
slow/paginated-only.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/SEARCH/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
