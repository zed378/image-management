# 07 - Client-Side <Image/> Component

> Category: **SDKs & Client Libraries** (`docs/SDK/`) &nbsp;|&nbsp; Status: Draft specification &nbsp;|&nbsp; Owner: TBD

## Purpose

Specify client-side <image/> component for the Image Management & Delivery Platform. Thin, typed clients over the public API contract, plus a client-side image component pattern so consumer applications can request transformed images declaratively instead of hand-building query strings..

## Category Mandate

Thin, typed clients over the public API contract, plus a client-side image component pattern so consumer applications can request transformed images declaratively instead of hand-building query strings.

## Key Topics To Specify

- Define the concrete rules for client-side <image/> component -- concepts alone are not sufficient; every rule must be specific enough to write a test against.
- State explicit defaults for every configurable value related to client-side <image/> component.
- Note every place in the codebase / other documents that must stay consistent with this document if it changes.

## Reference Example

```
<Image
    assetId="asset_01HQ..."
    width={800}
    height={600}
    fit="cover"
    position="center"
/>
```
resolves, client-side, to:
```
https://img.example.com/asset_01HQ...?w=800&h=600&fit=cover&position=center&format=auto
```
`format=auto` is added by the component, not the caller -- this is the main
reason to prefer the component over a hand-built URL.

## Acceptance Criteria

- [ ] The document states every default value explicitly -- nothing is left to "whatever the library does".
- [ ] Every rule in this document is either testable by an automated test or explicitly marked as a manual/operational check.
- [ ] Cross-references to related documents are correct and bidirectional (the related document links back here).

## Open Questions

- Confirm this against the current PLAN/17-PRICING-ENTITLEMENT.md tiering before implementation starts.
- Flag any decision here that should be promoted to a MEMORY/DECISIONS.md ADR once made.

## Related Documents

- `docs/SDK/README.md` (category index)
- `docs/PLAN/01-PRODUCT-REQUIREMENTS.md` (traces every requirement back here)
- `TASKS/` (the phase and task that implements this document)
- `MEMORY/DECISIONS.md` (record the decision here once made, don't leave it only in this file)
