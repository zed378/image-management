# 05 - Asset Sourcing & Licensing

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Where every photograph, font, and icon on the site comes from, and under
what licence. The requirement is free for commercial use; the harder
requirement is *provably* free for commercial use, with the evidence
recorded before launch rather than reconstructed during a complaint.

> **This document is engineering guidance, not legal advice.** Licence terms
> change. Verify the current licence text at the URL recorded for each asset
> at the time you add it, and keep the copy. `docs/PLAN/20-RISK-REGISTER.md`
> owns the residual risk.

---

## The rule that matters more than the licence

A stock-photo licence grants you the **photographer's copyright**. It does
not grant you:

- **Personality / publicity rights** -- the right to use an identifiable
  person's likeness to promote a commercial product. Most free-stock
  licences explicitly exclude implying endorsement by a depicted person.
- **Trademark rights** -- a visible logo, a distinctive product design, or
  branded packaging in the frame belongs to its owner regardless of who took
  the photo.
- **Property releases** -- some recognizable buildings and artworks carry
  their own restrictions.

For a commercial landing page, this points at one simple policy:

> **Prefer photographs with no identifiable people and no visible
> trademarks.**

Which, conveniently, is also what the product should be demonstrating:
physical goods, interiors, textiles, food, architectural detail. Those are
this platform's actual traffic (e-commerce catalogs and marketplaces), they
have the high-frequency detail a compression demo needs, and they carry
neither likeness nor brand exposure.

---

## Photographs

### Approved sources

| Source | Licence | Attribution | Notes |
|---|---|---|---|
| **Unsplash** | Unsplash License | Not required (appreciated) | Broadest selection. **Note the clause prohibiting compiling Unsplash photos to build a competing/similar service** -- using them as demo content on our site is within scope; shipping them as a sample asset library inside the product would need review |
| **Pexels** | Pexels License | Not required | Prohibits selling unaltered copies and implying endorsement by depicted people or brands |
| **Pixabay** | Pixabay Content License | Not required | Prohibits redistribution as-is; check per-asset, some items are sourced differently |
| **Wikimedia Commons** | Per-file: CC0, CC BY, CC BY-SA, public domain | Varies | Excellent for architectural and object photography. Prefer CC0 and CC BY; **avoid CC BY-SA**, whose share-alike obligation on derivatives is a poor fit for site assets we transform |
| **Openverse** | Aggregates CC-licensed work | Varies per file | Useful for search; always verify at the original source, not at the aggregator |

Not approved without a paid licence and a recorded receipt: Google Images
results, Pinterest, any "free download" site without a named licence,
anything found via an AI image search.

**Not permitted at all:** AI-generated imagery. Beyond the provenance and
copyright uncertainty, a page arguing for image fidelity that illustrates
itself with synthetic images undercuts its own claim
([`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md)).

### Selection criteria

Beyond licensing, an image has to earn its place technically:

1. **At least 3000px on the long edge.** The hero demonstrates a 4000px
   original becoming a 640px derivative. A 1200px source cannot show that.
2. **High-frequency detail** -- fabric weave, wood grain, foliage, crowd
   texture. A flat studio background compresses to almost nothing in every
   format and demonstrates no difference between them.
3. **Also one deliberately flat, product-on-white shot.** The honest
   counter-example: it shows that format choice matters less when the source
   compresses well, which is a true and credible thing to admit.
4. **A wide tonal range**, so AVIF's advantage in gradients is visible.
5. **No identifiable people, no visible trademarks** (the rule above).
6. **Subject matches the use case** -- products, interiors, food, textiles,
   architecture.

### Target set: 8 images

| Slot | Subject | Why |
|---|---|---|
| 1 | Hero: a single well-lit physical object, mid-century furniture or similar | The main demonstration. Detail plus clean silhouette |
| 2 | Product on a white background | The flat counter-example |
| 3 | Textile or knitwear close-up | Worst case for compression; makes the format comparison vivid |
| 4 | Prepared food, overhead | The most common e-commerce category after apparel |
| 5 | Interior with strong daylight gradient | Where AVIF visibly wins |
| 6 | Architectural detail, repeating pattern | Shows resize quality and aliasing |
| 7 | Tall portrait-orientation object | Proves `fit` and `ar` handling on a non-landscape source |
| 8 | Image with deliberate EXIF orientation | Demonstrates `rot=auto` in the docs |

### Required record per asset

Committed at `apps/website/content/credits.json`, and rendered at
`/credits` (linked from the footer):

```json
{
  "id": "hero-armchair",
  "file": "originals/hero-armchair.jpg",
  "title": "Mid-century armchair",
  "photographer": "Photographer Name",
  "source": "Unsplash",
  "source_url": "https://unsplash.com/photos/XXXXXXX",
  "licence": "Unsplash License",
  "licence_url": "https://unsplash.com/license",
  "licence_retrieved": "2026-09-18",
  "licence_text_file": "licences/unsplash-2026-09-18.txt",
  "dimensions": "4000x2667",
  "bytes": 2883584,
  "identifiable_people": false,
  "visible_trademarks": false,
  "alt": "Mid-century armchair in tan leather, front three-quarter view"
}
```

`licence_text_file` is the point of the exercise: a committed snapshot of
the licence as it read on the day the asset was added. A licence URL that
has since changed proves nothing.

A CI check verifies every image referenced by the site has a `credits.json`
entry with a non-empty `licence`, `source_url`, and `alt`. An uncredited
image fails the build -- which is the only mechanism that actually works,
because the alternative is remembering.

---

## Typefaces

Requirements: an open licence permitting web embedding, self-hosted (no
third-party font CDN -- it is a privacy exposure, an extra connection, and a
render-blocking dependency), variable where available, and a genuinely good
monospace, since monospace is load-bearing here.

| Role | Candidates | Licence family |
|---|---|---|
| Text / UI | Inter, Public Sans, Source Sans 3, IBM Plex Sans, Geist | SIL Open Font License |
| Monospace | JetBrains Mono, IBM Plex Mono, Source Code Pro, Geist Mono | SIL Open Font License |
| Optional display / `/protocol` body | Source Serif 4, IBM Plex Serif, Literata | SIL Open Font License |

Rules:

- Self-host as WOFF2, subset to the characters actually used, with
  `font-display: swap` and a matched fallback stack to limit layout shift.
- Two families. Three only if `/protocol` adopts a serif
  ([`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md) open question).
- Variable fonts preferred: one file instead of six weights.
- **Verify the licence for the specific version you download**, and commit
  the `OFL.txt` alongside the font files. SIL OFL requires the licence to
  travel with the font, including in a web deployment.
- Avoid a pairing so common it is itself a signature. Inter plus JetBrains
  Mono is excellent and extremely widely used; a less-defaulted pairing
  (for instance Public Sans with IBM Plex Mono) is equally free and reads
  as more considered.

---

## Icons

| Set | Licence |
|---|---|
| Lucide | ISC |
| Heroicons | MIT |
| Tabler Icons | MIT |
| Phosphor Icons | MIT |

One set only, inlined as SVG sprites, sized on a consistent grid, coloured
with `currentColor`. Commit the licence file. No emoji as icons
([`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md)).

---

## Assets we produce ourselves

These are the strongest assets on the site, and they have no licence
question at all:

| Asset | Produced by |
|---|---|
| Hero panel screenshots (static fallback) | The deployed platform, captured at a recorded date |
| OG / social card images | Generated from the real hero panel |
| Architecture and pipeline diagrams | Hand-authored inline SVG from `docs/ARCHITECTURE/` |
| Dashboard screenshots | The real dashboard, with seeded demo data, never mocked-up in a design tool |
| Benchmark charts | `docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md` |
| Wordmark and favicon | Set in the licensed text face |

Screenshot policy: real UI with seeded data from
`packages/test-utils`. Never a design-tool mockup of a screen that does not
exist -- shipping a screenshot of unbuilt software is the same category of
dishonesty as an unearned logo wall, and it is discovered on the first day
of a trial.

---

## Acceptance Criteria

- [x] Every asset class (photos, fonts, icons, self-produced) has named
      sources and licence families.
- [x] The limits of a stock licence (likeness, trademark, property) are
      stated, with a policy that avoids them rather than relying on
      judgement per image.
- [x] Photograph selection criteria include the technical requirements the
      demonstration needs, not only the legal ones.
- [x] The per-asset record is specified as a committed, CI-verified
      artifact, including a snapshot of the licence text.
- [x] AI-generated imagery is excluded, with the reason.

## Open Questions

- The eight photographs are specified by subject, not chosen. Whoever
  chooses them should record the `credits.json` entry in the same commit as
  the file, or the record will not exist.
- Whether the product ships a sample asset library to new accounts is worth
  checking against the Unsplash clause about competing services. Using
  their photos as our marketing content is clearly fine; bundling them as
  product content is a different question and needs a look at the current
  licence text.
- Commissioning a small set of original product photographs would remove
  every licence question and produce genuinely distinctive imagery. Cost is
  modest relative to a launch; worth pricing before defaulting to stock.
- Typeface pairing is unchosen; the constraint against an over-defaulted
  pairing is a preference, not a requirement.

## Related Documents

- `docs/WEBSITE/04-VISUAL-DIRECTION.md` (how these assets are used)
- `docs/WEBSITE/03-LANDING-PAGE-COPY.md` (the `alt` text and credits line)
- `docs/WEBSITE/08-SEO-PERFORMANCE-A11Y.md` (font loading and image budgets)
- `docs/WEBSITE/09-LAUNCH-CHECKLIST.md` (the credits CI gate)
- `docs/PLAN/20-RISK-REGISTER.md` (residual licensing risk)
- `docs/IMAGE-PROCESSING/12-METADATA-EXIF.md` (the EXIF fixture in slot 8)
