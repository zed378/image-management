# Website

The public web presence: the marketing site (landing page and its supporting
pages) and the developer documentation site. Two different products for two
different readers, planned together because they share a design system, a
build pipeline, and one promise -- that a platform selling image performance
must itself be fast.

This category is **planning and content**, not implementation. It specifies
what the pages say, how they are structured, how they look, where every
asset comes from, and how they are judged. `TASKS/PHASE-7-...` owns the
building.

## Documents

- [`00-COMPETITIVE-LANDSCAPE.md`](./00-COMPETITIVE-LANDSCAPE.md) -- Competitive Landscape
- [`01-POSITIONING-AND-MESSAGING.md`](./01-POSITIONING-AND-MESSAGING.md) -- Positioning & Messaging
- [`02-LANDING-PAGE-STRUCTURE.md`](./02-LANDING-PAGE-STRUCTURE.md) -- Landing Page Structure
- [`03-LANDING-PAGE-COPY.md`](./03-LANDING-PAGE-COPY.md) -- Landing Page Copy
- [`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md) -- Visual Direction
- [`05-ASSET-SOURCING.md`](./05-ASSET-SOURCING.md) -- Asset Sourcing & Licensing
- [`06-DOCS-SITE-PLAN.md`](./06-DOCS-SITE-PLAN.md) -- Documentation Site Plan
- [`07-DOCS-CONTENT-PLAN.md`](./07-DOCS-CONTENT-PLAN.md) -- Documentation Content Plan
- [`08-SEO-PERFORMANCE-A11Y.md`](./08-SEO-PERFORMANCE-A11Y.md) -- SEO, Performance & Accessibility
- [`09-LAUNCH-CHECKLIST.md`](./09-LAUNCH-CHECKLIST.md) -- Launch Checklist

## The one principle everything here follows

**The site is the product's first integration test.**

An image delivery platform whose own landing page ships oversized images,
fails Core Web Vitals, or serves JPEG to a browser that accepts AVIF has
refuted its entire pitch above the fold. So the landing page is not built
with stock hero art and a gradient; it is built **on the platform itself**,
serving its own images through its own delivery URLs, with the real byte
counts visible on the page.

That constraint is also the honest answer to "make sure the UI is not AI
slop" (see [`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md)): the page
cannot be generic decoration, because its job is to demonstrate a specific
technical claim with real artifacts. Authenticity by construction beats
authenticity by taste.

## Relationship to the rest of the repository

| This category defers to | For |
|---|---|
| `docs/PLAN/00-PRODUCT-OVERVIEW.md`, `02-PRODUCT-SCOPE.md` | What the product is and is not. Copy may not promise what scope excludes. |
| `docs/PLAN/17-PRICING-ENTITLEMENT.md` | Every number on the pricing section |
| `docs/UI-UX/00-DESIGN-DIRECTION.md`, `02-DESIGN-SYSTEM.md` | The design system. The site extends it; it does not fork it. |
| `docs/DEVELOPER/` | The substance of every documentation page |
| `docs/IMAGE-DELIVERY-PROTOCOL/04-TRANSFORMATION-PARAMETERS.md` | Every URL shown anywhere on the site, including in copy |
| `docs/PERFORMANCE/` | The performance numbers quoted as claims |

A claim on the landing page that no `docs/` file supports is a marketing
invention, and it does not ship. Every quantitative claim in
[`03-LANDING-PAGE-COPY.md`](./03-LANDING-PAGE-COPY.md) is annotated with the
document or measurement that has to substantiate it first.
