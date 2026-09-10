# 11 - IDOR / BOLA Prevention

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify idor / bola prevention for the Image Management & Delivery Platform. Assume every :id in the API is guessable or enumerable; the only acceptable defense is a resource-ownership check on every single request, and this document's acceptance criteria is: automated tests exist for every :id endpoint proving a foreign tenant's ID returns 404, not 200 or 403.

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the controls that defend against IDOR/BOLA, malicious uploads, credential abuse, and denial of service. Security documents take precedence over convenience: if a feature specification and a security document conflict, the security document wins until the conflict is explicitly resolved and recorded.

## Key Topics To Specify

- Assume every :id in the API is guessable or enumerable; the only acceptable defense is a resource-ownership check on every single request, and this document's acceptance criteria is: automated tests exist for every :id endpoint proving a foreign tenant's ID returns 404, not 200 or 403.
- Broken Object Level Authorization is functionally the same class of bug as IDOR in this platform's context; treat the two as one control and one test suite.

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
