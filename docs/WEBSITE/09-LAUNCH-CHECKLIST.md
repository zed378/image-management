# 09 - Launch Checklist

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The gate between "the site is built" and "the site is public". Ordered by
what blocks what, so a blocker is discovered before the work that depends on
it, not after.

---

## Stage 0 -- Blockers that precede building

None of the site work below is worth starting until these exist, because
each one determines content that would otherwise have to be rewritten.

- [ ] **Product name and domain** chosen (`docs/PLAN/00-PRODUCT-OVERVIEW.md`).
      Every `{{PRODUCT}}` in `03-LANDING-PAGE-COPY.md` resolves.
- [ ] **`docs/PLAN/17-PRICING-ENTITLEMENT.md` Final.** Hard blocker on the
      pricing section, and the pricing section is a hard blocker on the page
      (`02-LANDING-PAGE-STRUCTURE.md`, section 10).
- [ ] **At least one real measurement** for the hero: a genuine
      original-to-derivative byte comparison from our own pipeline
      (`P3-01`, `docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md` -- note that its
      synthetic-fixture numbers must be re-measured on the real photographs
      before any byte figure is published).
- [ ] **A deployed delivery path** the hero panel can call, or a decision to
      ship the hero in static mode with a measurement date.
- [ ] **Accent colour and typefaces** chosen and contrast-verified
      (`04-VISUAL-DIRECTION.md`, `05-ASSET-SOURCING.md`).
- [ ] **Eight photographs** selected, with `credits.json` entries and
      committed licence snapshots (`05-ASSET-SOURCING.md`).

## Stage 1 -- Content complete

- [ ] Every section of `02-LANDING-PAGE-STRUCTURE.md` built, with copy from
      `03-LANDING-PAGE-COPY.md`.
- [ ] Every `[[N]]` placeholder replaced with a measured number, or the
      section shipped in its prose-only form. **No placeholder ships as a
      plausible-looking invented figure.**
- [ ] Every PROOF line in the copy document satisfied, or the claim removed.
- [ ] Banned-vocabulary pass over all site copy
      (`01-POSITIONING-AND-MESSAGING.md`).
- [ ] Documentation pages from `07-DOCS-CONTENT-PLAN.md` written for: start
      here (3), all 9 guides, all 5 reference pages, 4 SDK pages, 4
      operating pages.
- [ ] `/protocol` rendered from `docs/IMAGE-DELIVERY-PROTOCOL/`, with the
      conformance fixture downloadable.
- [ ] `/credits`, `/changelog`, `/status`, and all `/legal/*` pages exist
      and are accurate.
- [ ] `/docs/responsive` written (it has no existing `docs/` source --
      `07-DOCS-CONTENT-PLAN.md` open question).

## Stage 2 -- Truthfulness audit

The pass that protects the positioning. Run by someone who did not write the
copy.

- [ ] Every quantitative claim traced to a `docs/` file or a recorded
      measurement, with hardware and date where applicable.
- [ ] No claim about unbuilt behaviour anywhere on the site, including in
      the reference and the SDK pages.
- [ ] Scope exclusions on `/docs` match `docs/PLAN/02-PRODUCT-SCOPE.md`
      exactly.
- [ ] No certification badge that is not actually held.
- [ ] No logo wall, no testimonial, no metric that is not real
      (`02-LANDING-PAGE-STRUCTURE.md` exclusions).
- [ ] Every parameter name on the site matches
      `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md`,
      including case.
- [ ] The migration claim verified by actually running an imgix URL and a
      Cloudinary URL against the deployed platform.

## Stage 3 -- Automated gates green

All from `08-SEO-PERFORMANCE-A11Y.md`, all blocking in CI:

- [ ] Lighthouse CI >= 98 in all four categories on `/`, `/docs`,
      `/docs/quickstart`, `/protocol`.
- [ ] Performance budgets met: LCP <= 1.8 s, CLS <= 0.02, INP <= 120 ms,
      JS <= 45 KB, total transfer <= 400 KB, requests <= 25.
- [ ] `axe-core`: zero violations, both themes, all four routes.
- [ ] Image checks: every site image delivered through the platform; none
      more than 1.5x its largest rendered width; total image bytes within
      budget.
- [ ] Credits check passes for every image.
- [ ] Every documentation code sample executes successfully.
- [ ] Quickstart end-to-end test passes.
- [ ] Link check: no broken internal or `docs/` links.
- [ ] HTML validation clean.

## Stage 4 -- Manual verification

Automated tools catch roughly a third of accessibility issues, and none of
the things that make a page feel wrong.

- [ ] Keyboard-only pass on the full landing page and the docs, including the
      hero parameter controls, SDK tabs, copy buttons, and search.
- [ ] Screen reader: one pass on macOS (VoiceOver) and one on Windows
      (NVDA). The hero's live region announces correctly.
- [ ] 200% browser zoom: no loss of content or function.
- [ ] 320px viewport: no horizontal scroll on the page body; tables,
      diagrams, and code blocks scroll within their own containers.
- [ ] Both themes reviewed on a real display, not only in devtools.
- [ ] A real mid-range Android phone on a throttled connection.
- [ ] JavaScript disabled: the page is complete and the hero shows real
      numbers as text.
- [ ] Print / reader mode: legible, no clipped content.
- [ ] Every outbound and internal link clicked once by a human.
- [ ] Copy read aloud. Anything that sounds like a brochure gets rewritten.

## Stage 5 -- Operational readiness

- [ ] The hero panel's and `/migrate`'s abuse surface constrained: fixed
      allowlist of demo asset ids and parameter values, rate limited
      (`02-LANDING-PAGE-STRUCTURE.md` open question). An unconstrained
      public transformation endpoint is a free image-processing service for
      the internet.
- [ ] Redirects: `www`/apex decided, one canonical host, permanent
      redirects for any URL that changed during development.
- [ ] `robots.txt`, `sitemap.xml`, canonical tags verified live.
- [ ] Structured data validated, and containing nothing invented.
- [ ] Analytics decision made and implemented (or deliberately omitted).
- [ ] Error pages (404, 500) styled, with the copy from
      `03-LANDING-PAGE-COPY.md`.
- [ ] `/status` reflects reality and is hosted independently of the main
      site, so an outage does not take the status page with it.
- [ ] Security headers: CSP, HSTS, `X-Content-Type-Options`, referrer
      policy. CSP verified against the hero panel's own fetches.
- [ ] Legal review of `/legal/*` and the pricing page.
- [ ] Monitoring on the site itself, and an alert if the hero's delivery
      endpoint starts failing -- the page degrades gracefully, but someone
      should know.

## Stage 6 -- Post-launch, first week

- [ ] Real-user Core Web Vitals compared against the lab budgets. Lab
      numbers are a floor, not evidence.
- [ ] Re-survey competitor pages (`00-COMPETITIVE-LANDSCAPE.md`) and correct
      anything our copy now misstates.
- [ ] Docs search queries reviewed for terms that return nothing -- the
      cheapest source of documentation gaps available.
- [ ] Quickstart completion measured. If readers drop at a specific step,
      that step is the bug.
- [ ] First support questions triaged into `/docs/troubleshooting`.

## Acceptance Criteria

- [x] Ordered by dependency, so stage 0 blockers surface before dependent
      work begins.
- [x] Every automated gate traces to a specified check in
      `08-SEO-PERFORMANCE-A11Y.md`.
- [x] A truthfulness audit exists as its own stage, run by someone who did
      not write the copy.
- [x] Manual checks that automation cannot cover are enumerated explicitly.
- [x] Post-launch verification included, so lab numbers are not mistaken for
      evidence.

## Open Questions

- Who owns the truthfulness audit. It should not be the person who wrote the
  copy, and on a small team that may mean the engineer who implemented the
  feature being claimed.
- Whether launch waits for `P7-05`'s measured latency numbers, or ships with
  the mechanism-only performance section and fills the tiles later.
  Recommended: ship without them. A missing number is credible; an invented
  one is not recoverable.

## Related Documents

- `docs/WEBSITE/` (every document in this category feeds a stage here)
- `docs/PLAN/17-PRICING-ENTITLEMENT.md` (stage 0 hard blocker)
- `docs/PLAN/19-ACCEPTANCE-CRITERIA.md` (the product's own launch criteria)
- `docs/DEVOPS/02-CI-CD.md` (where stage 3 runs)
- `TASKS/PHASE-7-OBSERVABILITY-PERFORMANCE-LAUNCH.md` (`P7-09` launch readiness review)
