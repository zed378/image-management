# 07 - Documentation Content Plan

> Category: **Website** (`docs/WEBSITE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Page-by-page: what each documentation page must accomplish, what it
contains, where its substance comes from, and how it is verified. The IA is
in [`06-DOCS-SITE-PLAN.md`](./06-DOCS-SITE-PLAN.md); this is the brief for
writing each page.

Every page is specified with the same four fields, because a page whose job
is unstated becomes a feature dump.

---

## Start here

### `/docs` -- What this is

- **Job:** in 30 seconds, tell a reader whether this product solves their
  problem, including when it does not.
- **Contains:** the one-paragraph description; the upload/transform/deliver
  triple; an explicit "what this is not" list (no DAM, no video, no
  generative editing, storage is yours); links to quickstart and protocol.
- **Source:** `docs/PLAN/00-PRODUCT-OVERVIEW.md`, `02-PRODUCT-SCOPE.md`.
- **Verified by:** the scope list matching `PLAN/02` exactly. A doc that
  over-promises relative to scope is the first thing that erodes trust.

### `/docs/quickstart` -- Ten minutes, end to end

- **Job:** a working transformed image URL in ten minutes, with no prior
  reading.
- **Contains:** create a project; get an API key; create the bucket
  connection; `POST /v1/assets`; the returned asset id; one `GET` with `?w=`
  that the reader opens in a browser; one `<img srcset>` to paste. Every
  step copy-pasteable, every response shown.
- **Source:** `docs/DEVELOPER/01-QUICKSTART.md`.
- **Verified by:** **an end-to-end CI test that performs exactly these
  steps in this order.** The quickstart is the highest-traffic page and the
  one whose breakage is most costly; it gets the strongest guarantee on the
  site. The landing page's closing copy says "if it does not work in ten
  minutes, the quickstart is the bug" -- that sentence is only safe to print
  because of this test.

### `/docs/concepts` -- Core concepts

- **Job:** define the vocabulary once so every other page can be precise.
- **Contains:** asset, version, original, derivative, object, object key,
  cache key, `params_hash`, derivative id, project, application, API key.
  One paragraph and one diagram each; the distinctions that actually confuse
  people (version vs derivative; object key vs cache key) called out
  explicitly.
- **Source:** `docs/ENGINEERING/03-NAMING-CONVENTIONS.md` (domain
  vocabulary table), `docs/ASSET/`, `docs/DATABASE/`.
- **Verified by:** review against the naming table; no term used elsewhere
  on the site that is undefined here.

---

## Guides

Each guide follows one shape: the task, the minimum working example, the
options that matter, the failure modes, and what to read next. The failure
modes section is the one competitors omit and the one readers need.

| Page | Job | Source | Must include |
|---|---|---|---|
| `/docs/auth` | Authenticate a request | `DEVELOPER/02` | Key format, header, scoping to project, rotation, what a revoked key returns, that the key is shown once |
| `/docs/upload` | Get an original in | `DEVELOPER/03`, `API/11` | Direct upload and presigned flow, size and format limits, idempotency key, what happens to EXIF, abandoned-upload behaviour |
| `/docs/fetch` | Get an image out | `DEVELOPER/04`, `API/14` | The delivery URL form, cache headers, conditional requests, what a 404 vs 410 means |
| `/docs/transform` | Change an image | `DEVELOPER/05`, `IDP/03`, `04` | The parameter table (generated), the canonicalization guarantee, worked examples per `fit` value with real images |
| `/docs/query` | Find assets | `DEVELOPER/06`, `API/15`, `16` | Filters, sorting, cursor pagination, why there is no offset |
| `/docs/signed-urls` | Restrict access | `DEVELOPER/07`, `IDP/21`-`23` | The canonical string, a worked HMAC example with test vectors, expiry, clock skew, what each failure returns |
| `/docs/webhooks` | React to events | `DEVELOPER/08`, `WEBHOOK/` | Event list, payload schemas, signature verification, retry schedule, idempotent handling, replay |
| `/docs/responsive` | Ship correct `srcset` | new | `srcset`+`sizes` vs `dpr` and why not both, the width ladder, `<picture>` vs `f=auto`, a complete copyable example |
| `/docs/migrate` | Move from a competitor | `DEVELOPER/13` | The alias table, a URL-by-URL mapping for imgix and Cloudinary, what is not supported, a dual-running strategy |

The `/docs/responsive` page has no existing `docs/` source and needs
writing. It is worth its own page rather than a section of `/docs/transform`
because getting `srcset` right is the single highest-value thing a reader
can learn here, and because `ADR-014`'s width ladder only makes sense in
that context.

---

## Reference

| Page | Generated from | Notes |
|---|---|---|
| `/docs/reference/parameters` | `packages/transform-params` registry | Name, aliases, type, range, default, interactions. Generated so it cannot drift from `IDP/04` |
| `/docs/reference/api` | OpenAPI spec | Endpoints, schemas, status codes, examples |
| `/docs/reference/errors` | `packages/errors` registry | One anchor per code, each with cause, fix, and whether it is retryable. Searchable by the literal code string |
| `/docs/reference/limits` | Config schema + `PLAN/15-QUOTA-LIMITS.md` | **Every** numeric bound in one table with units: max upload bytes, max dimension, pixel budget, TTL bounds, rate limits, quota defaults |
| `/docs/reference/changelog` | Git + `IDP/30` | Protocol and API version history, breaking changes flagged |

The `limits` page is deliberately one page. On every competitor site these
numbers are scattered across five pages and a pricing table, and finding
them is a recurring annoyance.

---

## SDKs

| Page | Must include |
|---|---|
| `/docs/sdk/typescript` | Install, configure, upload, build a URL, sign a URL, error handling, types |
| `/docs/sdk/react` | `<Image/>` props, `srcset` generation, placeholder/blur behaviour, SSR notes, bundle size |
| `/docs/sdk/php` | Install, configure, upload, URL building, signing |
| `/docs/sdk/go` | Same, plus context/timeout handling |

Every SDK page opens with the equivalent **plain HTTP** call, so a reader on
an unsupported language is never stranded. The URL is the API; SDKs are
convenience (`03-LANDING-PAGE-COPY.md`, section 9).

---

## Operating

| Page | Job | Must include |
|---|---|---|
| `/docs/best-practices` | Use it well | Width ladders, avoiding cardinality blowup, when to use `dpr`, caching headers, when to pre-generate |
| `/docs/caching` | Explain the cache | Edge vs derivative store vs application cache (the three are routinely confused), what invalidates what, `stale-while-revalidate` |
| `/docs/performance` | Set expectations honestly | Which operations are cheap, which are expensive and why (encoder effort and the AVIF size guard named explicitly, with the `docs/PERFORMANCE/02` numbers), cold vs warm latency, what to expect on a catalog import |
| `/docs/troubleshooting` | Fix it now | Symptom-first |

`/docs/troubleshooting` entries, symptom-first, each with cause and fix:

- "My image returns 404" -- wrong project, foreign asset id, soft-deleted, or
  never finished uploading
- "My crop parameter is ignored" -- `g` requires `fit=cover`; check
  `X-Image-Ignored-Params`
- "I get 400 on a URL that works elsewhere" -- a near-miss parameter name
  (`ADR-013`); the response names the suspected intent
- "My images are not AVIF" -- the browser's `Accept`, or an explicit `f=`
- "The first request is slow, later ones are fast" -- expected; cold
  transform vs cache hit, with the numbers
- "My signed URL fails" -- expiry, clock skew, a parameter outside the
  signature, or the wrong application secret
- "Different sizes than I asked for" -- the dimension ladder is enabled on
  this project
- "My bill is higher than expected" -- derivative cardinality; how to
  measure and reduce it

`/docs/performance` is the page that most builds credibility with a senior
reader, precisely because it admits costs. It should carry the real
benchmark numbers from `docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md` with the
hardware and date stated.

---

## `/protocol`

A rendering of `docs/IMAGE-DELIVERY-PROTOCOL/`, presented as a
specification: numbered sections, stable anchors, normative MUST/SHOULD
language preserved, a version banner, and a downloadable conformance
fixture.

Deliberately **not** rewritten for friendliness. Its audience is an
evaluator or an implementer, and its value is that it reads like a
specification rather than marketing. The guides are where friendliness
lives.

---

## Writing standards

- Second person, present tense, active voice.
- Every claim about behaviour is checkable by running something on the page.
- Every numeric value carries a unit and links to the limits table.
- No placeholder values that look real (`sk_live_...` in a sample teaches a
  reader to paste a live key into a doc example). Use obviously-fake,
  clearly-marked placeholders.
- Every parameter name matches `IDP/04` exactly, including case.
- The banned-vocabulary list from `01-POSITIONING-AND-MESSAGING.md` applies
  to documentation too.
- Prose explains *why* at least once per guide. Reference explains *what*
  and never *why*.

## Acceptance Criteria

- [x] Every page in the IA has a job, contents, a named source, and a
      verification method.
- [x] Generated pages are identified as generated, with their source
      package.
- [x] Pages needing new writing (`/docs/responsive`) are called out rather
      than assumed to exist.
- [x] Troubleshooting is specified symptom-first with concrete entries.
- [x] The quickstart's CI guarantee is stated, since the landing page copy
      depends on it.

## Open Questions

- `/docs/responsive` has no `docs/` source. It should probably become a new
  `docs/DEVELOPER/` document so the public page has a specification behind
  it like every other page, rather than being authored only on the website.
- Whether `/docs/performance` publishes absolute numbers or relative ratios
  is a judgement call: absolute numbers are more useful and more falsifiable
  as hardware changes. Recommended: publish absolute with hardware and date
  attached, and re-measure per release.
- SDK reference generation approach (`P6-06`, `P6-08`).
- An interactive API explorer ("try it" against a demo project) is high
  value and has the same abuse surface as the landing page's live panel
  (`02-LANDING-PAGE-STRUCTURE.md` open question).

## Related Documents

- `docs/WEBSITE/06-DOCS-SITE-PLAN.md` (the IA and tooling)
- `docs/DEVELOPER/` (the source for every guide)
- `docs/IMAGE-DELIVERY-PROTOCOL/` (the source for `/protocol`)
- `docs/PLAN/15-QUOTA-LIMITS.md` (the limits table)
- `docs/ENGINEERING/03-NAMING-CONVENTIONS.md` (the published vocabulary)
- `docs/PERFORMANCE/02-IMAGE-PROCESSING-PERFORMANCE.md` (the performance page's numbers)
