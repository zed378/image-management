# 09 - Resource Access Control

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify resource access control for the Image Management & Delivery Platform. Every resource-scoped endpoint (GET/PUT/DELETE /assets/:id) must independently verify the caller's principal has access to that specific resource's tenant/project, not just that the caller is authenticated.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the controls that defend against IDOR/BOLA, malicious uploads, credential abuse, and denial of service. Security documents take precedence over convenience: if a feature specification and a security document conflict, the security document wins until the conflict is explicitly resolved and recorded.

## Key Topics To Specify

- Every resource-scoped endpoint (GET/PUT/DELETE /assets/:id) must independently verify the caller's principal has access to that specific resource's tenant/project, not just that the caller is authenticated.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/SECURITY/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
