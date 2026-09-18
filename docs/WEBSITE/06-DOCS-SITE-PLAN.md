# 06 - Documentation Site Plan

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The structure, tooling, and operating rules for the public documentation
site. For this product the documentation *is* the sales motion: the primary
audience decides by reading (`01-POSITIONING-AND-MESSAGING.md`), and our
stated differentiator is a published specification. The docs site is
therefore a first-class deliverable, not a by-product.

---

## Three surfaces, one site

| Surface | Reader | Source of truth |
|---|---|---|
| **Guides** (`/docs/…`) | Someone integrating for the first time | `docs/DEVELOPER/` |
| **API reference** (`/docs/api/…`) | Someone with a specific question, mid-task | OpenAPI spec, generated |
| **Protocol specification** (`/protocol/…`) | Someone evaluating, or implementing a client | `docs/IMAGE-DELIVERY-PROTOCOL/` |

Keeping these separate matters. A guide may simplify and omit; a reference
must be complete; a specification must be normative and versioned. Merging
them produces a document that is authoritative about nothing, which is the
state of every competitor's parameter documentation.

## Information architecture

```
/docs
├── Start here
│   ├── What this is                 <- DEVELOPER/00-GETTING-STARTED.md
│   ├── Quickstart (10 minutes)      <- DEVELOPER/01-QUICKSTART.md
│   └── Core concepts                <- asset / version / derivative / project
├── Guides
│   ├── Authentication               <- DEVELOPER/02
│   ├── Upload an image              <- DEVELOPER/03
│   ├── Fetch an image               <- DEVELOPER/04
│   ├── Transform an image           <- DEVELOPER/05
│   ├── Query and search assets      <- DEVELOPER/06
│   ├── Signed URLs                  <- DEVELOPER/07
│   ├── Webhooks                     <- DEVELOPER/08
│   ├── Responsive images            <- srcset, sizes, dpr
│   └── Migrating from imgix/Cloudinary  <- DEVELOPER/13
├── Reference
│   ├── Transformation parameters    <- generated from the protocol table
│   ├── API endpoints                <- generated from OpenAPI
│   ├── Error codes                  <- DEVELOPER/10, generated from the registry
│   ├── Rate limits and quotas       <- DEVELOPER/11
│   └── Limits and defaults          <- one table of every numeric bound
├── SDKs
│   ├── TypeScript / Node
│   ├── React (<Image/>)
│   ├── PHP
│   └── Go
└── Operating
    ├── Best practices               <- DEVELOPER/12
    ├── Caching behaviour
    └── Troubleshooting              <- symptom-first, not feature-first

/protocol
├── Overview and design principles   <- IMAGE-DELIVERY-PROTOCOL/00, 01
├── URL and canonicalization         <- 02, 03, 04
├── Transformations                   <- 05..15
├── Pipeline and identity            <- 16, 17, 18
├── Delivery semantics               <- 19, 20, 25..29
├── Signed URLs                      <- 21, 22, 23
├── Versioning and compatibility     <- 30, 31
├── Conformance vectors              <- 37, plus the downloadable fixture
└── Examples                         <- 39
```

Two ordering rules, both chosen against the common default:

- **Quickstart is second, not tenth.** The reader's first question is "does
  this work", not "what is your data model".
- **Troubleshooting is organized by symptom**, not by feature. A reader
  arrives with "my image is 404ing" or "my crop is being ignored", never
  with "I would like to read about parameter validation".

## Tooling

Requirements, in priority order:

1. **Content in Markdown/MDX in this repository**, versioned with the code
   it documents. Docs in a separate CMS drift within a month.
2. **Static output.** The docs site must be deployable as static files
   behind a CDN with no runtime.
3. **Excellent search**, client-side, no third-party dependency that ships a
   tracking script.
4. **Generated pages are generated**, not hand-copied: API reference from
   OpenAPI, error codes from `packages/errors`, the parameter table from
   `packages/transform-params`' registry.
5. **Code samples that are tested** (see below).
6. Fast: the budgets in
   [`08-SEO-PERFORMANCE-A11Y.md`](./08-SEO-PERFORMANCE-A11Y.md) apply here
   too.

Candidate generators: Astro Starlight, Docusaurus, VitePress, Nextra, or a
bespoke Next.js/Astro route inside `apps/website`. The choice is `P7-10`'s
and should turn on requirement 4 -- how easily the generator ingests
generated content -- rather than on theme quality.

**One site or two:** the marketing site and the docs site share a design
system, a header, and a deployment. Building them as one application with
two route trees is simpler than two apps that must stay visually in sync.
Recommended: one `apps/website` with `/`, `/docs`, and `/protocol`.

## Rules that keep the docs true

These are what separate documentation that stays correct from documentation
that decays.

- **Every code sample is executed in CI** against a live test project. A
  sample that does not run is the most expensive typo on the site, because
  it fails in a prospect's terminal during evaluation. Samples live as real
  files under `apps/website/samples/`, are run by the test suite, and are
  *included* into the page rather than pasted.
- **Every documented parameter, error code, and endpoint is generated from
  the implementation.** Hand-written reference tables diverge; `ADR-012`'s
  parameter table exists precisely so there is one machine-readable source.
- **No page documents unbuilt behaviour.** A page for a planned feature is a
  support ticket with a delay fuse. If it must be signalled, that belongs on
  `/changelog` as "planned", not in the reference.
- **Every page states what it does not cover** and links onward. The most
  common documentation failure is a reader finishing a page still not
  knowing whether their case is handled.
- **Versioning:** the protocol and the API are versioned
  (`docs/IMAGE-DELIVERY-PROTOCOL/30-VERSIONING.md`,
  `docs/API/04-API-VERSIONING.md`). The docs site keeps the current version
  plus the previous one, with a visible switcher and a banner on any
  non-current page. Not every historical version -- that is a maintenance
  burden nobody reads.
- **"Last reviewed" dates**, per page, generated from git. A guide with no
  date is a guide a reader cannot calibrate trust against.
- **Copy buttons on everything copyable**, and URLs in samples that use a
  real, working demo asset id so a reader can paste one into a browser
  immediately.

## Things that make developer docs good, and are usually skipped

- A **"core concepts"** page that defines asset, version, derivative,
  project, and application once, so every other page can use the words
  precisely. `docs/ENGINEERING/03-NAMING-CONVENTIONS.md` already fixes this
  vocabulary internally; the public version is a straight translation.
- **A limits table** in one place: every maximum, default, and quota with
  its unit. Readers hunt for these across five pages on every competitor
  site.
- **A downloadable conformance fixture** at `/protocol/conformance`. This is
  unusual, cheap for us (`P3-10` produces it anyway), and it is proof of the
  central claim rather than an assertion of it.
- **Error codes as first-class pages**, each with the cause and the fix, so
  searching the literal code string lands on something useful.
- **Honest performance guidance:** which parameter combinations are cheap,
  which are expensive, and why. Telling a developer that AVIF encoding is
  expensive and how the platform handles it builds more trust than implying
  everything is free.

## Acceptance Criteria

- [x] Three surfaces defined with distinct readers and distinct sources of
      truth, and the reason not to merge them.
- [x] Full IA down to page level, mapped to the `docs/` file that supplies
      each page's substance.
- [x] Tooling stated as ranked requirements rather than a product choice, so
      `P7-10` can choose against criteria.
- [x] The mechanisms that keep docs accurate (CI-executed samples, generated
      reference, no unbuilt features) are specified as rules with
      enforcement, not aspirations.

## Open Questions

- Generator choice is `P7-10`'s, against requirement 4 above.
- Whether `/protocol` is published under an open licence (spec and
  conformance vectors, not implementation) -- it would materially strengthen
  the positioning and is nearly free. Needs an ADR
  (`01-POSITIONING-AND-MESSAGING.md` open question).
- Search: a client-side index is preferred, but the protocol specification
  is large enough that the index size needs checking against the
  performance budget.
- Whether SDK reference docs are generated from source annotations
  (TSDoc/godoc/phpDoc) or hand-written per SDK is a `P6-06`/`P6-08`
  decision.

## Related Documents

- `docs/WEBSITE/07-DOCS-CONTENT-PLAN.md` (what each page says)
- `docs/WEBSITE/02-LANDING-PAGE-STRUCTURE.md` (the shared shell)
- `docs/DEVELOPER/` (the substance of the guides)
- `docs/IMAGE-DELIVERY-PROTOCOL/` (the substance of `/protocol`)
- `docs/API/04-API-VERSIONING.md`, `docs/IMAGE-DELIVERY-PROTOCOL/30-VERSIONING.md`
- `docs/ENGINEERING/03-NAMING-CONVENTIONS.md` (the vocabulary core concepts publishes)
