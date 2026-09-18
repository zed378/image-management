# 08 - SEO, Performance & Accessibility

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The measurable quality bar for the site, and the gates that enforce it.

This document has an unusual weight for a marketing site. A platform selling
image delivery performance whose own pages are slow, or whose own images are
oversized, has published a counter-argument to itself. Any prospect can
verify it in thirty seconds with a browser devtools panel, and a technical
evaluator absolutely will.

---

## Performance budgets

Enforced in CI on every pull request touching `apps/website`. A regression
fails the build; it is not a warning.

| Metric | Budget | Why this number |
|---|---|---|
| **LCP** | <= 1.8 s (p75, mobile, throttled) | "Good" threshold is 2.5 s. We claim image performance, so a mid-tier target is not defensible |
| **CLS** | <= 0.02 | Effectively zero. The hero panel swaps images; every box is pre-reserved with `aspect-ratio` |
| **INP** | <= 120 ms | The only interactive element is the parameter panel |
| **TTFB** | <= 200 ms (p75) | Static files from a CDN. Anything higher means a misconfiguration |
| **JS shipped, landing page** | <= 45 KB gzipped | The page is text, images, and one interactive panel |
| **JS shipped, docs page** | <= 60 KB gzipped | Plus search |
| **CSS** | <= 20 KB gzipped | One design system, no utility-class bloat shipped unused |
| **Fonts** | <= 90 KB total | Two variable faces, subset, WOFF2 |
| **Total transfer, landing page** | <= 400 KB | Including every image at the size actually displayed |
| **Requests, landing page** | <= 25 | |
| **Lighthouse (all four categories)** | >= 98 | |

The total-transfer budget is the one that matters most rhetorically. If the
landing page of an image optimization platform weighs a megabyte, no claim
on it is believable.

### Image rules on our own site

The site is the product's first customer, and it must follow the advice
`/docs/best-practices` gives:

- Every image delivered **through the platform**, from the platform's own
  bucket. Not from the web host's `public/` directory. This is the page's
  central proof and it must be verifiable in the network panel.
- `srcset` with width descriptors plus `sizes` on every image. No image
  served larger than it renders at, at any breakpoint or DPR.
- `f=auto` so the negotiated format is genuinely AVIF or WebP where
  supported. A `Content-Type: image/jpeg` on our own hero, to a browser
  sending `Accept: image/avif`, is a self-inflicted wound.
- Exactly one preloaded image: the hero's delivered image, as
  `<link rel="preload" as="image" imagesrcset=…>`. Everything else
  `loading="lazy"` with explicit `width`/`height`.
- `fetchpriority="high"` on the LCP image, and nothing else.
- Widths chosen from the ladder in `ADR-014`, so our own URLs demonstrate
  the practice we recommend.

A CI check asserts the page's total image bytes and that no image's
intrinsic width exceeds 1.5x its largest rendered width. Dogfooding is a
claim; the check is what makes it true next quarter too.

### Delivery configuration

- Static assets: immutable, content-hashed filenames, `Cache-Control:
  public, max-age=31536000, immutable`.
- HTML: short `max-age` with `stale-while-revalidate`, so a deploy
  propagates without a slow first byte.
- HTTP/2 or /3, Brotli, `Early Hints` where the CDN supports it.
- No third-party origin in the critical path. No font CDN, no tag manager,
  no chat widget, no A/B testing script. Each of those is a DNS lookup, a
  TLS handshake, a privacy exposure, and a way for someone else's outage to
  break our page.

---

## SEO

### Structural

- One `h1` per page; heading levels descend without skipping.
- Server-rendered HTML. Every word readable with JavaScript disabled --
  including the hero's numbers, which are text, not canvas or image.
- Canonical URLs; a single host (decide `www` or apex and redirect the
  other).
- `sitemap.xml` and a `robots.txt` that allows crawling of `/docs` and
  `/protocol`.
- Clean, stable, human-readable URLs. Documentation URLs are pasted into
  issues and Stack Overflow answers for years; a URL change is a broken
  citation, so redirects are permanent and never removed.
- Structured data: `SoftwareApplication` on `/`, `TechArticle` on guide
  pages, `BreadcrumbList` in docs. Only where it is accurate -- invented
  `AggregateRating` markup is a manual-action risk and a lie.

### Content

The realistic organic opportunity is not "image CDN" -- that term is owned
by companies with a decade of domain authority. It is the long tail of
specific technical questions, where our documentation is a genuinely better
answer than a competitor's marketing page:

- `srcset` and `sizes` correctness
- AVIF versus WebP, with real measurements
- imgix / Cloudinary URL parameter equivalents
- how to avoid cache fragmentation on image URLs
- EXIF and GPS stripping

Each of those maps to a page already planned in
[`07-DOCS-CONTENT-PLAN.md`](./07-DOCS-CONTENT-PLAN.md). The SEO strategy is
therefore "write the documentation well", not a separate content programme.
`/protocol` is the strongest asset: nobody else publishes one, so it
competes for queries with no incumbent.

### AI and agent crawlability

An increasing share of evaluation happens through an assistant summarizing
options rather than a human reading five landing pages. The same properties
that serve traditional SEO serve this -- server-rendered text, semantic
headings, real tables, honest numbers with units -- with two additions:

- Parameter tables, limits, and error codes as real HTML `<table>` markup.
  A table rendered as an image or built from `<div>`s is extractable by
  nobody.
- The specification published as plain, linkable, stable text so it can be
  quoted correctly.

No cloaking, no separate machine-only content. The same page, well
structured.

---

## Accessibility

Target: **WCAG 2.2 Level AA**, verified by automated checks plus a manual
keyboard and screen-reader pass before launch. Automated tools catch roughly
a third of real issues; the manual pass is not optional.

### Requirements

- **Keyboard:** every interactive element reachable and operable, in a
  logical order, with a visible focus indicator meeting 3:1 contrast. The
  hero's parameter controls, the SDK tabs, the code copy buttons, and the
  docs search all included. Tabs use arrow-key navigation with
  `aria-selected`.
- **Screen reader:** the hero panel announces its result through a polite
  live region ("Delivered 640 by 427 pixels, AVIF, 38 kilobytes"). Real
  `alt` text on every photograph, describing the photograph, not the
  transformation (`03-LANDING-PAGE-COPY.md`).
- **Contrast:** 4.5:1 body text, 3:1 large text and UI boundaries, in
  **both** themes. Checked as part of the design-token definition, not
  after.
- **Motion:** `prefers-reduced-motion: reduce` removes all transitions and
  the panel animation.
- **Zoom:** usable at 200% zoom and at 320px width with no horizontal
  scroll on the page body. Code blocks, tables, and diagrams get their own
  scroll containers.
- **Forms:** the URL parameter inputs and the migration converter have
  real labels, not placeholder-only, and errors are announced.
- **Semantics:** landmark regions, a skip link as the first focusable
  element, `<table>` for tabular data with proper headers.
- **Language:** `lang` set correctly; if an Indonesian version ships, per
  page.

### Deliberate decisions

- **No accessibility overlay widget.** They do not deliver conformance and
  they add a third-party script to a page with a 45 KB JS budget.
- **The interactive hero has a non-interactive equivalent.** With
  JavaScript unavailable it renders as the static before/after with real
  numbers as text -- which is also its fallback when the delivery endpoint
  is unreachable, so one implementation serves both cases.

---

## The gates

All in CI, all blocking, per `docs/DEVOPS/02-CI-CD.md`:

1. Lighthouse CI on `/`, `/docs`, `/docs/quickstart`, `/protocol` -- budgets
   above, mobile throttled.
2. `axe-core` on the same routes, zero violations, both themes.
3. Image-bytes and oversize check (above).
4. Link check: no broken internal links, no broken links into `docs/`.
5. Credits check: every image has a `credits.json` entry
   (`05-ASSET-SOURCING.md`).
6. Code-sample execution: every documentation sample runs
   (`06-DOCS-SITE-PLAN.md`).
7. Quickstart end-to-end test (`07-DOCS-CONTENT-PLAN.md`).
8. HTML validation on rendered output.

Manual, pre-launch, recorded in `docs/WEBSITE/09-LAUNCH-CHECKLIST.md`:
keyboard-only pass, one screen reader on each of macOS and Windows, 200%
zoom, both themes, a real mobile device on a throttled connection.

## Acceptance Criteria

- [x] Every budget is a number with a stated reason, not a generic "be
      fast".
- [x] The site's own image handling is specified to follow the product's own
      advice, with a CI check enforcing it.
- [x] SEO strategy is tied to pages already planned rather than a separate
      content programme, and the honest assessment of competitive terms is
      stated.
- [x] Accessibility target named with both automated and manual
      verification, and the two deliberate decisions justified.
- [x] Every requirement here maps to a listed CI gate or a listed manual
      check.

## Open Questions

- Analytics: a privacy-respecting, cookieless, self-hosted option is
  compatible with these budgets; a full tag manager is not. Needs a decision
  before launch, and it is as much a positioning choice as a technical one.
- The 400 KB total-transfer budget assumes eight images at displayed size.
  It needs re-checking once the photographs are chosen, and the budget
  should win over an extra image.
- Whether `/protocol` is excluded from the JS budget (it may want a larger
  search index) is a `P7-10` decision.

## Related Documents

- `docs/WEBSITE/04-VISUAL-DIRECTION.md`, `05-ASSET-SOURCING.md`
- `docs/WEBSITE/06-DOCS-SITE-PLAN.md`, `07-DOCS-CONTENT-PLAN.md`
- `docs/WEBSITE/09-LAUNCH-CHECKLIST.md`
- `docs/PERFORMANCE/03-IMAGE-DELIVERY-PERFORMANCE.md` (the product claims this page must not contradict)
- `docs/DEVOPS/02-CI-CD.md` (where the gates run)
- `docs/UI-UX/02-DESIGN-SYSTEM.md` (contrast tokens)
- `MEMORY/DECISIONS.md` (`ADR-008` format negotiation, `ADR-014` width ladder)
