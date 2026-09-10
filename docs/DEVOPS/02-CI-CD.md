# 02 - CI/CD

> Category: **DevOps** (`docs/DEVOPS/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify ci/cd for the Image Management & Delivery Platform. Define the pipeline stages (lint, typecheck, unit test, integration test, build, security scan) and which stages block merge vs. which are advisory.

## Category Mandate

Environments, containerization, CI/CD, configuration and secrets management, migrations, backup/restore, and disaster recovery -- the operational machinery that keeps the platform deployable and recoverable.

## Key Topics To Specify

- Define the pipeline stages (lint, typecheck, unit test, integration test, build, security scan) and which stages block merge vs. which are advisory.
- Define the deployment pipeline per service/environment, required approvals for production, and how a deploy is verified (smoke test, canary metrics) before being considered successful.

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
