# 05 - Asset Tags

> Category: **Asset Management** (`docs/ASSET/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify asset tags for the Image Management & Delivery Platform. Free-form or controlled-vocabulary labels attached many-to-many to assets, indexed for filtering in the Search API.

## Category Mandate

An 'asset' is the platform's core resource: an uploaded original plus its metadata, versions, and generated derivatives. These documents define the full asset lifecycle -- identity, upload, versioning, tagging, organization, duplication, deletion, and restoration -- independent of any single consumer application's data model.

## Key Topics To Specify

- Free-form or controlled-vocabulary labels attached many-to-many to assets, indexed for filtering in the Search API.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/ASSET/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
