# 00 - Competitive Landscape

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

What the five providers a prospect is most likely to compare us against
actually say on their own landing pages, verified by reading those pages
rather than from memory. This is the input to
[`01-POSITIONING-AND-MESSAGING.md`](./01-POSITIONING-AND-MESSAGING.md): you
cannot choose a position without knowing which positions are occupied.

Surveyed 2026-09-18 by reading each vendor's live landing page. Headlines
are quoted exactly; everything else is summarized.

---

## The five

### Cloudinary -- the enterprise incumbent

- **Headline:** "The World's Visual Experiences Start Here"
- **Sub:** "AI-native platform and APIs for automating the entire image and video lifecycle at scale."
- **Structure:** hero -> customer logos (Mattel, Adidas, Paul Smith, Guess) -> persona cards ("Built for Developers, Teams, and Agents") -> use cases -> integrations -> trust metrics -> case studies -> AI capabilities -> "visual media lifecycle" (7 phases) -> product cards -> resources
- **Social proof:** 80 billion assets, 4 million developers, Gartner Magic Quadrant, IDC and Aragon accolades
- **CTA:** "Sign Up for Free" + "Contact Sales"
- **Pricing on page:** no
- **Read:** maximum surface area. Every audience, every capability, analyst
  badges. Positioned to win an enterprise procurement committee, which is
  also why the page cannot say anything specific.

### imgix -- the performance specialist

- **Headline:** "Optimize, Transform & Deliver Visuals at Scale"
- **Sub:** "The complete visual media platform for teams that care about performance. Automatic compression, AI transformations, and lightning-fast delivery for images and videos."
- **Structure:** hero -> feature demos (smart crop, focal point, background removal, auto-compress) -> three benefit columns -> benefit cards -> capability overview -> case study carousel -> page-speed assessment tool -> newsletter
- **Social proof:** "Powering 8B+ images a day for brands like Unsplash, Skims, and Porsche"
- **Notable:** a real before/after showing **187KB to 16KB**
- **CTA:** "Start My Free Trial" (30 days, 100 credits, no card)
- **Pricing on page:** no
- **Read:** the closest competitor to our intended position, and the only
  one that puts a concrete byte number on the page. That 187KB-to-16KB
  figure is the single most persuasive element across all five sites.

### ImageKit -- the mid-market challenger

- **Headline:** "The complete visual media platform for websites and apps"
- **Sub:** "Transform and deliver optimized images and videos in real-time, manage assets in a DAM with its own AI agent, and automate on-brand creatives at scale, all in one platform without enterprise complexity or unpredictable costs."
- **Structure:** hero -> trust badges (300K developers, 3,000+ businesses) -> why ImageKit (4 value props) -> processing -> DAM -> creative automation -> 12 testimonials -> security certifications -> SDKs -> footer
- **Social proof:** 12 attributed testimonials from CTOs with quantified results ("30% faster load time", "35% reduction in bandwidth"); ISO 27001, SOC 2, GDPR badges
- **CTA:** "Start free" + "Talk to sales"
- **Pricing on page:** no (link to /plans/)
- **Read:** explicitly positions *against* the incumbent -- "without
  enterprise complexity or unpredictable costs" is aimed squarely at
  Cloudinary. Note that their own sub-headline is 38 words long, which
  undercuts the simplicity claim it is making.

### Bunny.net Optimizer -- the price disruptor

- **Headline:** "Bunny Optimizer | Dynamic Image resizer powered by a CDN"
- **Sub:** "Faster website. Made simple."
- **Structure:** hero -> trust (1.5M websites) -> four-step flow (Connect -> Transform API -> Optimize -> Deliver) -> metrics -> benefits -> **pricing** -> features -> SEO benefits -> testimonials -> final CTA
- **Social proof:** Trustpilot/G2/WordPress badges, 80% compression, 97% cache hit rate, 50B+ images
- **CTA:** "Start your FREE Trial", no card, "under 5 minutes"
- **Pricing on page:** **yes, prominently** -- $9.50/month per site, unlimited transformations, CDN bandwidth billed separately
- **Read:** the only one with a genuine brand personality (warm palette, a
  mascot, playful voice) and the only one that states a price. Both are
  deliberate differentiation against an opaque-pricing category. The
  four-step diagram is the clearest explanation of the category on any of
  the five sites.

### Uploadcare -- the developer-experience play

- **Headline:** "Build file handling in minutes"
- **Sub:** "Upload, store, transform, optimize, and deliver images, videos, and documents to billions of users."
- **Structure:** hero -> social proof (10,000+ teams, partner logos) -> **live demo** -> features -> enterprise readiness + testimonial -> CDN map -> pricing tier preview -> footer
- **Social proof:** Zapier, UserTesting, Prezly; 25B+ requests/week, 99.99% uptime; SOC 2, GDPR, HIPAA; a testimonial that quantifies build-vs-buy ("would probably take a team of 3 or 4 developers several months")
- **CTA:** "Start now for free" + "Get a demo"
- **Pricing on page:** yes, free tier stated (1,000 operations, 5 GB traffic, 1 GB storage)
- **Read:** the best headline of the five -- it names a *developer outcome*
  and a *time*, not a category. The live demo is placed third, above
  features, which is the correct order for a developer audience.

---

## What every one of them does

1. **Claims to be a "complete platform."** Four of five use the phrase
   "complete" or "entire lifecycle." The category has converged on breadth
   as the pitch.
2. **Leads with logos.** Social proof sits immediately below the hero on all
   five.
3. **Sells AI.** Background removal, generative fill, AI agents, "AI-native."
4. **Hides pricing** (Cloudinary, imgix, ImageKit) or leads with it
   (Bunny, Uploadcare). There is no middle ground, and the split correlates
   exactly with whether the company sells to procurement or to developers.
5. **Bundles video and DAM.** Every one of them has expanded beyond images.

## Where the gaps are

These are the openings our positioning can occupy, each with the reason it
is available:

| Gap | Why it exists | Can we credibly claim it? |
|---|---|---|
| **A written, versioned protocol spec** | All five document their parameters as reference pages; none publishes the URL form as a *specification* with canonicalization rules, conformance vectors, and a versioning policy | Yes -- `docs/IMAGE-DELIVERY-PROTOCOL/` already is one. This is our most defensible and least imitable asset |
| **"Storage stays yours"** | All five are also the storage owner; leaving means re-uploading everything | Yes -- ADR-001/002. This is the core product promise, and no competitor can match it without rearchitecting |
| **Predictable, legible cost** | Credits, operations, transformations, bandwidth tiers -- the category's billing is deliberately hard to model | Partly -- needs `docs/PLAN/17-PRICING-ENTITLEMENT.md` finalized first |
| **Migration in an afternoon** | Everyone offers migration; nobody offers *URL compatibility* | Yes -- `ADR-012`'s alias table means imgix and Cloudinary URLs work unchanged. This is a concrete, demonstrable claim |
| **Specificity over breadth** | The whole category sells "complete." Nobody sells "does exactly this, extremely well" | Yes -- and `docs/PLAN/12` already scopes video, DAM, and generative AI *out* |

## What to deliberately not copy

- **"Complete visual media platform."** Four competitors already say it; a
  fifth voice saying it is inaudible, and our scope document says it would
  be untrue.
- **Analyst badges and vanity metrics.** A pre-launch product quoting "80B
  assets" is lying, and a prospect can tell.
- **Logo walls we have not earned.** An empty or fabricated "trusted by"
  strip is worse than none. Until there are real customers, the space
  belongs to something we *can* prove -- see
  [`02-LANDING-PAGE-STRUCTURE.md`](./02-LANDING-PAGE-STRUCTURE.md).
- **38-word sub-headlines**, particularly when the sentence is about
  simplicity.
- **AI capability claims.** Out of v1 scope. Claiming them would be the
  single fastest way to lose a technical evaluator's trust.

## Acceptance Criteria

- [x] Five providers surveyed from their live pages, headlines quoted
      verbatim, with the date of the survey recorded.
- [x] Shared patterns and unoccupied gaps identified separately, each gap
      annotated with whether we can credibly claim it and what it depends on.
- [x] An explicit do-not-copy list, so the next person writing copy does not
      re-derive the category's clichés.

## Open Questions

- Pricing transparency is the sharpest available differentiator, but it
  cannot be claimed until `docs/PLAN/17-PRICING-ENTITLEMENT.md` is Final.
  That document is therefore a blocker on the landing page's pricing
  section, not a parallel task.
- The survey covers self-serve positioning only. If an enterprise motion is
  planned, Akamai Image Manager, Fastly IO, and Cloudflare Images need the
  same treatment.
- Re-survey before launch: these pages change, and a competitive claim built
  on a stale reading is a claim that gets contradicted publicly.

## Related Documents

- `docs/WEBSITE/01-POSITIONING-AND-MESSAGING.md` (what we do with this)
- `docs/PLAN/00-PRODUCT-OVERVIEW.md`, `docs/PLAN/02-PRODUCT-SCOPE.md`
- `docs/PLAN/17-PRICING-ENTITLEMENT.md` (blocker for the pricing section)
- `docs/DEVELOPER/13-MIGRATION.md` (substantiates the migration claim)
- `MEMORY/DECISIONS.md` (`ADR-001`, `ADR-002`, `ADR-012`)
