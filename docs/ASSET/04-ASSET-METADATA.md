# 04 - Asset Metadata

> Category: **Asset Management** (`docs/ASSET/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify asset metadata for the Image Management & Delivery Platform. An 'asset' is the platform's core resource: an uploaded original plus its metadata, versions, and generated derivatives.

## Category Mandate

An 'asset' is the platform's core resource: an uploaded original plus its metadata, versions, and generated derivatives. These documents define the full asset lifecycle -- identity, upload, versioning, tagging, organization, duplication, deletion, and restoration -- independent of any single consumer application's data model.

## Key Topics To Specify

- Define the concrete rules for asset metadata -- concepts alone are not sufficient; every rule must be specific enough to write a test against.
- State explicit defaults for every configurable value related to asset metadata.
- Note every place in the codebase / other documents that must stay consistent with this document if it changes.

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
