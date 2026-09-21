# 01 - Positioning & Messaging

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Decide what we claim, to whom, and in what order -- before any copy is
written. Copy without a position is a list of features, and a list of
features is what every page in
[`00-COMPETITIVE-LANDSCAPE.md`](./00-COMPETITIVE-LANDSCAPE.md) already is.

---

## The position

> **An image delivery protocol you can read, on storage you already own.**

Two claims, both of which every surveyed competitor structurally cannot
make:

1. **A protocol, specified.** The URL format, every parameter, the
   canonicalization algorithm, the pipeline order, the cache-key derivation,
   and a versioning policy are published as a specification with conformance
   vectors -- not as a reference page that describes whatever the
   implementation currently does. Anyone can implement against it; anyone can
   verify us against it.
2. **Your storage stays yours.** The platform reads and writes storage you
   already own -- a local disk, an NFS or SMB share, an S3/R2/MinIO bucket,
   Azure Blob, SFTP, or WebDAV. Leaving means pointing a different service at
   the same storage, not re-uploading a catalog (`ADR-001`, `ADR-021`).

The category sells "complete platform." We sell a **narrow, specified,
non-capturing** one. The narrowness is the feature.

### Why this position and not a better-sounding one

The tempting positions and why each was rejected:

| Candidate | Rejected because |
|---|---|
| "Fastest image CDN" | Unprovable pre-launch, and the edge does most of the work in every competitor too. A claim a prospect can disprove with one `curl` is a liability |
| "Cheaper than Cloudinary" | Invites a price war we would lose, and `docs/PLAN/17-PRICING-ENTITLEMENT.md` is not Final |
| "AI-powered image optimization" | Out of scope (`docs/PLAN/12`), and the fastest way to lose a technical evaluator |
| "Complete visual media platform" | Four competitors say it; our scope document says it is not true |
| "Open source alternative to X" | Not a licensing decision this repository has made |

The chosen position has one property the others lack: **it is already true
in this repository.** `docs/IMAGE-DELIVERY-PROTOCOL/` exists, is 40
documents, and is more specified than any competitor's public parameter
reference. Positioning that describes something already built is the only
kind that survives a technical evaluation.

## Who we are talking to

Ordered by how much page real estate they get.

### Primary: the engineer who owns image delivery

A backend or full-stack engineer at a team of 5-50, running an e-commerce
catalog, a marketplace, a media site, or a user-generated-content product.
They already store images on a server disk, an NFS share, or in S3/R2. They have either hand-rolled
thumbnail generation with a Lambda and regret it, or they are on Cloudinary
and cannot model next month's bill.

- **Cares about:** the URL format, whether it caches, what breaks at 3am, the
  bill being predictable, not being locked in
- **Decides by:** reading the docs, then trying it in ten minutes
- **Killed by:** a signup wall before the docs, vague pricing, a "book a
  demo" button where a code sample should be

### Secondary: the tech lead doing build-vs-buy

Evaluating three vendors on a spreadsheet, needs to defend the choice.

- **Cares about:** lock-in, migration cost, the exit path, SLA, whether the
  parameter set is stable
- **Decides by:** the specification and the migration story
- **Killed by:** discovering the vendor also owns the storage

### Tertiary: the frontend engineer who just wants `<Image/>`

Arrives from the SDK docs, wants a component and a `srcset` that works.

- **Cares about:** framework support, DPR, `srcset` generation, bundle size
- **Decides by:** copying one snippet that works
- **Killed by:** a React example that is actually pseudocode

Explicitly **not** an audience for the landing page: marketers, DAM buyers,
procurement. Not because they do not matter commercially, but because
writing for them is what turned all five competitor pages into the same
page.

## Message hierarchy

What a reader must understand, in the order they must understand it. Each
level earns the next; a reader who bounces at level 2 should still have
gotten something true.

1. **What it is** -- images in, transformed images out, over a URL.
2. **What is different** -- the transformation URL is a published protocol,
   and the bytes live on storage you own.
3. **What it costs you to try** -- one URL change; imgix and Cloudinary
   parameter names already work.
4. **Why it is fast** -- one canonical cache key per derivative, so the edge
   actually caches (`ADR-004`).
5. **Why it is safe** -- multi-tenant isolation, signed URLs, no metadata
   leakage (`docs/SECURITY/`).
6. **What it costs** -- a number, on the page.

## Proof obligations

Every claim we make needs something behind it. This table is the contract
between the copy and the rest of the repository: **a row with no proof does
not ship on the page.**

| Claim | Proof | Status |
|---|---|---|
| The protocol is specified | `docs/IMAGE-DELIVERY-PROTOCOL/`, published as docs + conformance vectors | Available now |
| Storage stays yours | `ADR-001`, `ADR-021`, the adapter conformance suite (5 providers, real servers) | Available now |
| imgix/Cloudinary URLs work | The alias table (`ADR-012`), plus a live converter on the page | Needs `P3-02` |
| One derivative per transformation | `ADR-004` + golden vectors | Needs `P3-10` |
| Specific byte savings | Real measurements from the same pipeline the page runs on | **Needs `P3-01` benchmark** |
| Latency / cache hit rate | `docs/PERFORMANCE/` targets, then measured | Needs `P7-05` |
| Price | `docs/PLAN/17-PRICING-ENTITLEMENT.md` | **Blocker** |
| Uptime / SLA | An operated service with history | Not claimable at launch |

Two rows are hard blockers on the page shipping: pricing, and at least one
real byte-savings measurement. imgix puts "187KB to 16KB" on their page and
it is the most persuasive element on any of the five sites; we need our own
honest equivalent, generated by our own pipeline.

## Voice

Written for someone who will read the docs next. The test for every
sentence: **would this survive a technical evaluator reading it
skeptically?**

- Concrete over abstract. "One cache key per derivative" beats "intelligent
  caching."
- Numbers with units and provenance. "412 KB to 38 KB, AVIF, quality 55"
  beats "up to 90% smaller."
- Short sentences. Active voice. Second person.
- Name the trade-off. A page that admits what is expensive -- the first
  request for a new size, high encoder effort, the AVIF size guard's second
  encode -- and explains how that is handled is more credible than one that
  pretends everything is free (`docs/PERFORMANCE/02`, `ADR-016`).
- Say what it does not do. The scope exclusions are a feature for this
  audience.

### Banned vocabulary

Not stylistic preference -- these are the words that make a developer close
the tab, and they are also the exact register of machine-written marketing
copy:

> blazing fast, lightning-fast, seamless(ly), effortless(ly), supercharge,
> unlock, elevate, empower, revolutionize, game-changing, cutting-edge,
> state-of-the-art, next-generation, robust, leverage (as a verb),
> best-in-class, world-class, enterprise-grade, delightful, magical,
> "in today's fast-paced digital world", "we're excited to announce",
> "the complete platform for", "everything you need to"

Also banned: a sentence whose claim cannot be checked. "Optimized for
performance" is not a claim, it is a mood.

### Naming

The product name is unresolved (`docs/PLAN/00-PRODUCT-OVERVIEW.md`).
[`03-LANDING-PAGE-COPY.md`](./03-LANDING-PAGE-COPY.md) uses the placeholder
**`{{PRODUCT}}`** throughout so a name change is one find-and-replace, not a
copy rewrite. Constraints for whoever picks it: pronounceable in a standup,
available as a `.dev` or `.io`, not a real word that collides with image
tooling, and short enough to sit in a URL host (`cdn.{{product}}.io`)
without reading badly.

## Acceptance Criteria

- [x] One position, stated in a sentence, with the rejected alternatives and
      the reason each was rejected.
- [x] Audiences ranked, each with what kills the conversion, and the
      non-audiences named.
- [x] Every claim mapped to its proof and its status, with hard blockers
      marked.
- [x] Voice defined operationally (a test) and negatively (a banned list),
      not as adjectives.

## Open Questions

- Product name and domain (`docs/PLAN/00-PRODUCT-OVERVIEW.md`).
- Language: copy is written in English, matching the repository and the
  developer audience. Whether an Indonesian version of the marketing site
  ships at launch is a go-to-market decision, not a content one -- the
  documentation site should stay English-only regardless, since translated
  API docs drift and a stale translation is worse than none.
- Whether a free tier exists at all, which changes the primary CTA from
  "Start free" to something honest about a trial
  (`docs/PLAN/17-PRICING-ENTITLEMENT.md`).
- Open-sourcing the protocol specification and the conformance vectors
  (without the implementation) would make claim 1 far stronger and is nearly
  free, since `docs/IMAGE-DELIVERY-PROTOCOL/` already exists. Worth an ADR.

## Related Documents

- `docs/WEBSITE/00-COMPETITIVE-LANDSCAPE.md` (the input to this)
- `docs/WEBSITE/02-LANDING-PAGE-STRUCTURE.md`, `03-LANDING-PAGE-COPY.md`
- `docs/PLAN/00-PRODUCT-OVERVIEW.md`, `01-PRODUCT-REQUIREMENTS.md`, `02-PRODUCT-SCOPE.md`
- `docs/PLAN/17-PRICING-ENTITLEMENT.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/` (the thing claim 1 points at)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-002`, `ADR-004`, `ADR-012`)
