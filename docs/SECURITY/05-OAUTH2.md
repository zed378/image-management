# 05 - OAuth2

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify oauth2 for the Image Management & Delivery Platform. If the dashboard or a machine-to-machine integration needs it, define the supported grant types (authorization code + PKCE for the dashboard, client credentials for service accounts) -- API keys remain the default for simple server-to-server integration.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the controls that defend against IDOR/BOLA, malicious uploads, credential abuse, and denial of service. Security documents take precedence over convenience: if a feature specification and a security document conflict, the security document wins until the conflict is explicitly resolved and recorded.

## Key Topics To Specify

- If the dashboard or a machine-to-machine integration needs it, define the supported grant types (authorization code + PKCE for the dashboard, client credentials for service accounts) -- API keys remain the default for simple server-to-server integration.

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
