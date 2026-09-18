# 02 - Landing Page Structure

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The section-by-section specification of the landing page: what each section
must accomplish, what it contains, what proves it, and what it must not
become. Copy lives in
[`03-LANDING-PAGE-COPY.md`](./03-LANDING-PAGE-COPY.md); visual rules in
[`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md).

---

## Page inventory

The marketing site is deliberately small. Every page has a job; a page that
cannot state its job does not exist.

| Route | Job |
|---|---|
| `/` | The landing page specified below |
| `/pricing` | Full pricing, limits, and the "what counts as a transformation" table |
| `/docs` | The documentation site ([`06-DOCS-SITE-PLAN.md`](./06-DOCS-SITE-PLAN.md)) |
| `/protocol` | The rendered Image Delivery Protocol specification -- our differentiator, given its own front door |
| `/migrate` | Paste an imgix or Cloudinary URL, get ours back, with a diff |
| `/changelog` | Protocol and API version history (`docs/IMAGE-DELIVERY-PROTOCOL/30-VERSIONING.md`) |
| `/status` | Uptime, incidents |
| `/legal/*` | Terms, privacy, DPA, subprocessors |

No blog at launch. A blog with three posts is worse than no blog, and the
engineering effort belongs in `/protocol` and `/docs`.

---

## Section-by-section

### 1. Header

Sticky, thin, quiet. `{{PRODUCT}}` wordmark, then `Docs`, `Protocol`,
`Pricing`, `Changelog`, then `Sign in` and one primary action.

The primary action is the **only** filled button in the header. Two
competing buttons in a header means neither is primary.

No "Book a demo." The primary audience does not book demos; they open docs.

### 2. Hero -- the product demonstrating itself

This is the section that decides whether the page is credible or generic, so
it is specified tightly.

```
+--------------------------------------------------------------------------+
|                                                                          |
|  Headline (2 lines max, ~9 words)                                        |
|  Sub-headline (1 sentence, <= 25 words)                                  |
|                                                                          |
|  [ Read the protocol ]   [ Quickstart -> ]                               |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  |  LIVE TRANSFORMATION PANEL                                         |  |
|  |                                                                    |  |
|  |  cdn.{{product}}.io/i/01JABCDEF?w=[640]&fit=[cover]&f=[auto]       |  |
|  |                        ^ editable  ^ editable  ^ editable          |  |
|  |                                                                    |  |
|  |  +----------------------+   +----------------------+               |  |
|  |  |                      |   |                      |               |  |
|  |  |  original            |   |  delivered           |               |  |
|  |  |  4000x3000           |   |  640x480             |               |  |
|  |  |  JPEG - 2.75 MB      |   |  AVIF - 38 KB        |               |  |
|  |  +----------------------+   +----------------------+               |  |
|  |                                                                    |  |
|  |  x-cache: HIT   ttfb: 24 ms   -98.6%                               |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

Requirements:

- The URL is **real and editable**. Changing `w` re-requests through the
  actual delivery path. The numbers underneath are read from the real
  response, not hardcoded.
- The byte counts, the format, and `x-cache` come from the response headers.
  If the page cannot show real ones, the section ships as a static
  screenshot of real ones -- never as invented numbers.
- No hero illustration. No gradient mesh. The image being transformed *is*
  the hero visual, which is the whole point:
  [`04-VISUAL-DIRECTION.md`](./04-VISUAL-DIRECTION.md).
- Above the fold on a 1280x720 viewport: headline, sub, both buttons, and
  the top of the panel.
- The panel must not cause layout shift. Reserve its box with
  `aspect-ratio`; CLS budget in
  [`08-SEO-PERFORMANCE-A11Y.md`](./08-SEO-PERFORMANCE-A11Y.md).

**Proof obligation:** real measured numbers. Blocked on `P3-01`'s benchmark
and a deployed delivery path.

### 3. The three-line explanation

Immediately below the hero, replacing the logo wall we have not earned. The
job: a reader who reads only this understands the category and our shape of
it.

Three columns, each one line of code or URL plus one sentence of prose:
**upload**, **transform**, **deliver**. Bunny's four-step diagram is the
best explanation of this category on any competitor page; this is the same
idea, compressed and made concrete with real syntax.

### 4. "Your bucket stays yours"

The first differentiator, given a full section because it is the one no
competitor can match.

A diagram -- flat, technical, in the design system's stroke style, not an
isometric 3D illustration:

```
   your app  --->  {{PRODUCT}} API  --->  your S3 / R2 / MinIO bucket
                         |                         |
                         +---> transform --------->+
                                   |
                              CDN  ---> your users
```

With the honest consequence stated in prose: deleting your account leaves
your originals exactly where they are, and a competitor can be pointed at
the same bucket tomorrow. Say it that plainly -- the confidence is the
argument.

### 5. The protocol section

Our most defensible asset, and the section a tech lead will linger on.

- An excerpt of the real canonicalization rule -- two URLs written
  differently, one canonical form, one cache key. Taken verbatim from
  `docs/IMAGE-DELIVERY-PROTOCOL/03`.
- The parameter table, abbreviated, linking to the full one.
- A line about conformance vectors and versioning, linking to `/protocol`.

This section deliberately shows a *specification*, not a feature list. It
is aimed at the reader who has been burned by a vendor silently changing a
default.

### 6. Migration

Interactive. One input, one output:

```
  Paste an imgix or Cloudinary URL
  [ https://demo.imgix.net/img.jpg?w=800&h=600&fit=crop&fm=auto      ]
                                    |
                                    v
  [ https://cdn.{{product}}.io/i/01JABCDEF?w=800&h=600&fit=cover&f=auto ]
   fit=crop -> fit=cover      fm -> f       (both accepted as aliases)
```

The point is not the converter; it is that **the aliases are accepted
natively**, so the original URL works unchanged. The diff teaches the
mapping while proving the compatibility.

**Proof obligation:** the alias table shipping (`P3-02`).

### 7. Performance, stated as mechanism

Not "blazing fast." A short explanation of *why* it caches, with the
architecture stated: one canonical key per derivative, derivative reads
served from storage without touching the database, single-flight on misses.

Numbers here only once measured (`P7-05`). Until then the section explains
mechanism and shows the hero's real `x-cache`/TTFB rather than a fabricated
percentage.

### 8. Security and isolation

For the build-vs-buy reader. Short, factual, four items: per-project
isolation enforced at the query layer, signed URLs with published HMAC
construction, EXIF and GPS stripped by default, no cross-tenant
enumeration. Each links to the relevant `docs/SECURITY/` page.

Certification badges appear **only** when actually held. An aspirational
SOC 2 badge is a lie with a logo on it.

### 9. SDKs and frameworks

A row of real code tabs -- TypeScript, React `<Image/>`, PHP, Go, plain
`<img srcset>`. Each snippet must be copy-pasteable and actually run; the
plain-HTML tab exists because it is the honest baseline and it needs no
SDK at all.

### 10. Pricing

A summary of the real tiers, with the number visible. Bunny and Uploadcare
both show a price; Cloudinary, imgix, and ImageKit hide it. Showing it is a
differentiator for a developer audience, so the page shows it.

Also on the page: what counts as one transformation, what happens at the
limit (throttle or bill), and whether storage is billed at all (it is not
-- it is the customer's bucket, which is itself a pricing differentiator
worth stating).

**Hard blocker:** `docs/PLAN/17-PRICING-ENTITLEMENT.md` Final.

### 11. Closing call to action

One action, repeated from the hero. A second link to the docs. No
newsletter capture, no chat widget.

### 12. Footer

Dense and useful: product, docs, protocol, SDKs, status, changelog, legal,
contact. Not a sitemap of aspiration -- every link resolves.

---

## Sections deliberately excluded

| Excluded | Reason |
|---|---|
| Logo wall / "trusted by" | Nothing to put in it yet. An empty or padded one damages credibility more than its absence |
| Testimonial carousel | Same. ImageKit's 12 testimonials are their strongest asset and our weakest |
| Vanity metrics ("8B images/day") | Untrue pre-launch |
| Analyst badges | Not applicable |
| AI feature section | Out of scope (`docs/PLAN/12`). Claiming it loses the technical reader immediately |
| Video / DAM | Out of scope |
| Blog teasers | No blog at launch |
| Cookie-consent-driven chat widget | Hurts the performance budget, and this audience does not use it |

Each of these becomes available as the product earns it. The structure
above leaves room: sections 3 and 4 are where social proof goes once it is
real.

## Responsive behavior

Mobile is not a scaled-down desktop. Specific decisions:

- Hero panel stacks: URL bar, then **delivered** image, then original
  below. The delivered image is the product; it goes first.
- The three-line explanation becomes three stacked rows, code first.
- Code tabs become a horizontally scrollable tab strip, never a
  `<select>`.
- The protocol excerpt gets its own `overflow-x: auto` container rather
  than wrapping URLs -- a wrapped URL is unreadable and unselectable.
- Minimum 16px side gutter at every width; body never scrolls
  horizontally.

## Acceptance Criteria

- [x] Every section has a stated job, contents, and a proof obligation where
      it makes a claim.
- [x] Excluded sections are enumerated with reasons, so they are not
      reintroduced by default.
- [x] The hero is specified precisely enough to build without inventing,
      including its failure mode (static screenshot of real numbers) if live
      data is unavailable.
- [x] Responsive behavior specified per section, not left to the
      implementer.

## Open Questions

- Whether the hero's live panel calls the production delivery path or a
  rate-limited demo project is a `P7-11` implementation decision with a real
  abuse surface -- a public, unauthenticated transformation endpoint on the
  marketing site is a free image-processing service for the internet unless
  it is constrained to a fixed allowlist of asset ids and parameter values.
- `/migrate` needs an abuse policy for the same reason.
- Section 7's numbers depend on `P7-05`; until then the section is
  mechanism-only, and someone must resist the urge to fill it with a
  plausible-sounding percentage.

## Related Documents

- `docs/WEBSITE/01-POSITIONING-AND-MESSAGING.md`, `03-LANDING-PAGE-COPY.md`
- `docs/WEBSITE/04-VISUAL-DIRECTION.md`, `08-SEO-PERFORMANCE-A11Y.md`
- `docs/UI-UX/01-INFORMATION-ARCHITECTURE.md`, `02-DESIGN-SYSTEM.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/03-TRANSFORMATION-URL-SPECIFICATION.md` (section 5's content)
- `docs/DEVELOPER/13-MIGRATION.md` (section 6's content)
- `docs/PLAN/17-PRICING-ENTITLEMENT.md` (section 10's blocker)
- `docs/SECURITY/` (section 8's content)
