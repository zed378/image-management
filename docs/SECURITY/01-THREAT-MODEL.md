# 01 - Threat Model

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify threat model for the Image Management & Delivery Platform. Use STRIDE or an equivalent structured method against each trust boundary in ARCHITECTURE/02-SERVICE-BOUNDARIES.md; list concrete threats (signed URL forgery, tenant_id tampering, SSRF via remote-upload-by-URL) with a mitigation each.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the controls that defend against IDOR/BOLA, malicious uploads, credential abuse, and denial of service. Security documents take precedence over convenience: if a feature specification and a security document conflict, the security document wins until the conflict is explicitly resolved and recorded.

## Key Topics To Specify

- Use STRIDE or an equivalent structured method against each trust boundary in ARCHITECTURE/02-SERVICE-BOUNDARIES.md; list concrete threats (signed URL forgery, tenant_id tampering, SSRF via remote-upload-by-URL) with a mitigation each.
- Define the entity, its primary key strategy (ULID recommended for sortability), required columns, foreign keys, and the indexes needed for the query patterns this platform actually runs.

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
