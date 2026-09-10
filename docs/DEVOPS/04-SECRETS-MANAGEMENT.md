# 04 - Secrets Management

> Category: **DevOps** (`docs/DEVOPS/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify secrets management for the Image Management & Delivery Platform. Define where secrets (DB credentials, storage provider keys, signing keys, webhook HMAC secrets) live (a secrets manager, never in source control or plain environment files in the repo) and the rotation process.

## Category Mandate

Environments, containerization, CI/CD, configuration and secrets management, migrations, backup/restore, and disaster recovery -- the operational machinery that keeps the platform deployable and recoverable.

## Key Topics To Specify

- Define where secrets (DB credentials, storage provider keys, signing keys, webhook HMAC secrets) live (a secrets manager, never in source control or plain environment files in the repo) and the rotation process.
- Define the full key lifecycle: creation (scoped, shown once), listing (hash only, never plaintext, after creation), rotation (overlap window so old key keeps working briefly), and revocation (immediate).

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/DEVOPS/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
