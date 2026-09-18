# 04 - Visual Direction

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

How the site looks, and specifically how it avoids looking like every other
machine-assembled SaaS page. This document exists because "make it look
good" is not an instruction anyone can execute or review, whereas "no
gradient meshes, one accent colour, real screenshots only" is.

Extends `docs/UI-UX/00-DESIGN-DIRECTION.md` and
`docs/UI-UX/02-DESIGN-SYSTEM.md` -- the site uses the product's design
system rather than forking a second visual language.

---

## The governing idea

**The page's visuals are its evidence.**

Every image on this page is a real photograph, delivered by the platform,
from a real bucket, at a byte size shown in real text next to it. That is
not a stylistic choice -- it is the product's central claim, rendered.

This single constraint resolves most visual decisions without further
debate. There is no room for decorative abstraction in the hero, because the
hero's job is to show an actual transformation. There is no room for a
gradient blob, because the space it would occupy is where the delivered
image goes.

---

## Why generic pages look the way they do, and what to do instead

"AI slop" in a web page is not a rendering artifact; it is the visual
signature of decisions made without a specific thing to say. It has
recognizable components, and each one has a specific cause and a specific
replacement.

| The pattern | What it signals | Do instead |
|---|---|---|
| Purple-to-blue gradient mesh background | The page had nothing concrete to show | A flat surface. Put the real product where the gradient was |
| Glassmorphism cards floating over that gradient | Depth used to imply sophistication | Cards with a 1px border and no shadow, on a solid background |
| Isometric 3D illustration of servers and arrows | The architecture was described, not drawn | A flat stroke diagram with the real service names on it |
| Abstract "network of glowing nodes" | Decoration standing in for a mechanism | The actual mechanism: URL in, cache key, bucket, edge |
| Stock photo of a diverse team at a laptop | No real customers yet | Say there are no customers yet, and show the product instead |
| Centered hero, then exactly three equal feature cards | The section order was never decided | Asymmetric layout, sections of different heights, ordered by importance |
| Emoji as section icons | Icon set was never chosen | One consistent stroke icon set, or no icons |
| Every corner at 16px radius, every card with a soft shadow | Default component library, untouched | Pick one radius and one border treatment; use elevation almost never |
| Six-item feature grid where every item is one sentence | Features listed, not prioritized | Two or three sections with real depth, rest in the docs |
| Numbers with no units or source: "10x faster" | Nothing was measured | A number with a unit, a condition, and a date |
| Copy at the register of "unlock seamless performance" | Text generated to fill a slot | The banned-word list in `01-POSITIONING-AND-MESSAGING.md` |
| AI-generated illustration anywhere | -- | Do not. On a page about image fidelity it is self-refuting |

### The test

Before any visual element ships, answer: **what does a reader learn from
this that they could not learn from the text next to it?**

If the answer is "nothing, it fills the space" -- delete it and let the
space be empty. Whitespace reads as confidence. Decoration reads as
padding.

---

## Layout

- **Asymmetric, editorial.** A 12-column grid, but sections deliberately
  use different column spans and different heights. Perfect symmetry down a
  page is the strongest single signal of a template.
- **One idea per screen.** A reader scrolling should meet one claim at a
  time, at a comfortable pace, not a wall of parallel cards.
- **Generous, uneven whitespace.** Vertical rhythm from a spacing scale, but
  the important sections get more room than the supporting ones. Equal
  padding everywhere flattens the hierarchy the page spent effort building.
- **Max content width ~1200px**, prose columns capped at ~70 characters.
  Full-bleed only for the hero panel and the diagram.
- **Left-aligned headings.** Centered text down a whole page is a template
  default; centring is reserved for the one closing call to action.

## Typography

Type does most of the work on this page, because the page is mostly text and
real screenshots.

- **Two families, three at most.** One text face, one monospace. A display
  face only if the wordmark needs it.
- **Monospace is load-bearing, not decorative.** Every URL, parameter name,
  header, and byte count is monospace. On this product that is semantic: it
  marks the things that are literal strings a developer will type. It is
  also the single cheapest way to look like a developer tool rather than a
  brochure.
- **A real type scale**, geometric, roughly 1.25 ratio, defined in the
  design system. Not "whatever looks right per section".
- **Big headline, but not enormous.** 48-60px desktop for the `h1`.
  Beyond that is a landing-page cliché and it breaks at 400px.
- **Tabular figures** for every number in the metrics strip and the stat
  tiles, so a value changing does not shift the layout.
- Licensed for web embedding and self-hosted -- see
  [`05-ASSET-SOURCING.md`](./05-ASSET-SOURCING.md).

## Colour

- **One accent colour, used sparingly.** Primary button, active tab, focus
  ring, one inline link state. If the accent appears more than about five
  times on a screen, it has stopped being an accent.
- **Near-monochrome otherwise.** A warm or cool neutral ramp, not pure
  `#000` on pure `#FFF` -- pure black text on pure white is harsher than any
  print designer would set, and slightly-off neutrals read as deliberate.
- **Not purple, not the blue-violet gradient.** Occupied territory, and the
  single most recognizable signature of the category. Cloudinary is blue,
  imgix is dark, ImageKit is blue, Bunny is warm orange. A restrained warm
  neutral with a single saturated accent is both distinctive and cheap to
  execute well.
- **Semantic colour only where it means something**: error, warning,
  success, cache-hit versus cache-miss. Not as decoration.
- **Both themes are first-class.** A developer tool's site is read in dark
  mode as often as light. Define the full palette as tokens, and the dark
  theme is not an inverted light theme -- surfaces lift, borders soften,
  the accent desaturates slightly.
- **Contrast:** 4.5:1 minimum for body text, 3:1 for large text and UI
  borders, in both themes. Verified, not eyeballed
  ([`08-SEO-PERFORMANCE-A11Y.md`](./08-SEO-PERFORMANCE-A11Y.md)).

## Imagery

- **Photographs, not illustrations.** Real objects, real texture, real
  detail. Detail matters technically here: a flat illustration compresses to
  almost nothing in any format, so it cannot demonstrate a compression
  difference. A textured photograph can.
- **Subjects that match the use case:** physical products, interiors,
  food, textiles, architecture. This platform's traffic is e-commerce
  catalogs and marketplaces; a landscape photograph is pretty and
  irrelevant.
- **A small curated set, 6-10 images total.** A grid of thirty stock photos
  is the stock-photo look regardless of the photos' quality.
- **Every image delivered through the platform**, at the exact dimensions it
  is displayed at, with `srcset`, in the negotiated format.
- **No image carries text.** Text in an image cannot be read by a screen
  reader, indexed, or translated -- and on a page that transforms images, a
  rasterized headline is embarrassing.
- Licensing in [`05-ASSET-SOURCING.md`](./05-ASSET-SOURCING.md).

## Diagrams

The architecture diagram (section 4) and the pipeline diagram (section 5)
follow one style:

- Flat. Strokes and labels. No perspective, no gradient fills, no drop
  shadows, no glow.
- **Real names on every box** -- `your S3 bucket`, `transform worker`,
  `CDN edge` -- taken from `docs/ARCHITECTURE/`. A diagram with generic
  boxes teaches nothing.
- Inline SVG, theme-aware via `currentColor`, with a `<title>` and a text
  alternative. Not a PNG export.
- Legible at 400px wide. If it is not, it is too complex for a landing
  page; simplify the claim.

## Motion

- **Two purposes only:** revealing state (a tab switching, a value
  updating), and showing causality (a parameter change producing a new
  image).
- 120-200ms, ease-out. Nothing on this page needs to take half a second.
- **No scroll-triggered entrance animations.** Fading every section in on
  scroll is a template default that makes a page feel slower than it is and
  breaks reader-mode and print.
- No parallax, no auto-playing carousel, no counters that tick up from zero.
- `prefers-reduced-motion: reduce` removes all of it, including the hero
  panel's transition. Not a lesser experience -- the same page, instantly.

## Components

Borrowed wholesale from `docs/UI-UX/02-DESIGN-SYSTEM.md`. Site-specific
notes:

- **Buttons:** one filled style, one outline, one text link. Three total.
- **Code blocks:** the most-used component on the site. They get real
  attention -- a copy button, a language label, syntax highlighting that
  works in both themes, horizontal scroll rather than wrapping, and a
  selectable region that excludes the line numbers.
- **Tabs** for the SDK section: real tabs with arrow-key navigation and
  `aria-selected`, not styled radio buttons.
- **The hero panel** is the one bespoke component on the site. It is worth
  building properly because it is the page's entire argument.

## Favicon and wordmark

- A wordmark set in the text face, tightly tracked. No logomark at launch --
  a hastily-made abstract mark is worse than clean type, and this audience
  is not persuaded by logos.
- Favicon: a single letterform or a simple geometric mark that survives
  16x16. Test it at 16px before deciding, not at 512px.
- OG image: a real screenshot of the hero panel with real numbers, 1200x630.
  Not the wordmark on a gradient.

## Acceptance Criteria

- [x] The anti-generic guidance is a table of specific patterns with
      specific replacements, not a plea for taste.
- [x] Every visual decision (layout, type, colour, imagery, diagrams,
      motion) is stated as a rule a reviewer can check.
- [x] Both themes and reduced-motion are specified as first-class, not as
      afterthoughts.
- [x] The one bespoke component is identified, so effort concentrates where
      the page's argument lives.

## Open Questions

- The accent colour is described by constraint ("not purple, not the
  category gradient, one saturated hue against warm neutrals") rather than
  chosen. It should be picked together with
  `docs/UI-UX/02-DESIGN-SYSTEM.md` so the dashboard and the site share it,
  and it must be checked at 4.5:1 on both themes before being adopted.
- Typeface selection is open; the constraints are in
  [`05-ASSET-SOURCING.md`](./05-ASSET-SOURCING.md).
- Whether `/protocol` gets a distinct, more document-like treatment (serif
  body, wider measure, numbered sections) is worth considering: it is a
  specification, and making it look like one would reinforce the
  positioning.

## Related Documents

- `docs/UI-UX/00-DESIGN-DIRECTION.md`, `02-DESIGN-SYSTEM.md` (the system this extends)
- `docs/WEBSITE/02-LANDING-PAGE-STRUCTURE.md` (what is being styled)
- `docs/WEBSITE/03-LANDING-PAGE-COPY.md` (the voice this matches)
- `docs/WEBSITE/05-ASSET-SOURCING.md` (fonts, photos, icons and their licences)
- `docs/WEBSITE/08-SEO-PERFORMANCE-A11Y.md` (the budgets these rules must fit)
