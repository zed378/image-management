# Phase 7 -- Observability, Performance & Launch Readiness

Goal: the platform is operable, not just functional -- on-call can see what's
happening, performance targets are proven under load rather than assumed,
quotas/billing are actually enforced, and developer documentation is
complete enough for a stranger to integrate without asking a human first.

Exit criteria: every SLO has a dashboard and an alert; a load test proves
the numbers in `docs/PERFORMANCE/00-PERFORMANCE-REQUIREMENTS.md`; quota
enforcement (deferred since `P1-08`) is live; `docs/DEVELOPER/` is complete
and a fresh developer can follow it end to end.

---

### P7-01: Metrics across every service

- **Depends on:** P0-05
- **Implements:** `docs/OBSERVABILITY/02-METRICS.md`, `04-IMAGE-PROCESSING-METRICS.md`, `05-STORAGE-METRICS.md`, `06-CDN-METRICS.md`, `07-API-METRICS.md`

**Steps**
1. Instrument the minimum default metric set named in
   `docs/OBSERVABILITY/02-METRICS.md`: upload success rate, processing time
   (p50/p95/p99), delivery latency (p50/p95/p99), CDN hit ratio, storage
   usage, bandwidth usage, transformation count, API request count, 4xx
   rate, 5xx rate -- each tagged by tenant/application where cardinality
   allows.
2. Export to the chosen metrics backend (Prometheus + Grafana, or a hosted
   equivalent -- record the choice in `MEMORY/DECISIONS.md`).

**Definition of Done**
- [ ] Every metric named in `docs/OBSERVABILITY/02-METRICS.md` has a real
      dashboard panel, verified by screenshot or export attached to
      `MEMORY/records/P7-01.md`.

---

### P7-02: SLOs, SLIs & alerting

- **Depends on:** P7-01, P4-06
- **Implements:** `docs/OBSERVABILITY/08-SLO-SLI.md`, `09-ALERTING.md`

**Steps**
1. Set target SLOs backed by the metrics from `P7-01` (e.g. "99.9% of
   image delivery requests < 200ms at the edge (warm cache)", "99.5% API
   availability"), each with an explicit error-budget policy.
2. Wire an alert per SLO with a defined severity and a link to the
   relevant runbook (reuse `docs/SECURITY/19-INCIDENT-RESPONSE.md` for
   security incidents; add operational runbooks here for the rest).
3. Avoid alerting on raw metrics with no defined response -- every alert
   must name what the on-call engineer does next.

**Definition of Done**
- [ ] Every alert fired in a synthetic test (e.g. artificially degrading
      latency in staging) pages correctly and links to a runbook that
      exists.

---

### P7-03: Distributed tracing completion

- **Depends on:** P0-05, P3-09, P4-01
- **Implements:** `docs/ARCHITECTURE/14-OBSERVABILITY-ARCHITECTURE.md`, `docs/OBSERVABILITY/03-DISTRIBUTED-TRACING.md`

**Steps**
1. Confirm trace propagation actually reaches every service added since
   Phase 0 (Storage Service calls, Processing Service calls, queue-based
   webhook delivery) -- trace IDs must survive a hop through the queue too,
   not just synchronous HTTP calls.
2. Sample at a rate appropriate to traffic volume; ensure 100% sampling for
   error responses regardless of the base sample rate.

**Definition of Done**
- [ ] A single slow end-to-end request (upload -> process -> deliver) is
      visible as one connected trace across all services it touched.

---

### P7-04: Quota enforcement -- turn metering into limits

- **Depends on:** P1-08, P2-02, P3-08, P4-06
- **Implements:** `docs/PLAN/15-QUOTA-LIMITS.md`, `docs/DATABASE/15-QUOTAS.md`

**Steps**
1. Check the caller's current-period `usage` against `quotas` before an
   operation that would exceed it (upload, if storage-bound; delivery, if
   bandwidth-bound) and enforce the documented over-limit behavior (`429`
   vs. degraded service vs. queued) per metric.
2. Ensure the quota check is cheap enough not to become the new bottleneck
   on the hot delivery path -- read from a cached/near-real-time usage
   rollup, not a synchronous aggregate query per request.
3. Surface remaining quota to the dashboard (`P6-11`) and via an API
   endpoint SDKs can poll.

**Definition of Done**
- [ ] Exceeding a configured quota in a test environment produces exactly
      the documented response, tested for at least storage and bandwidth
      metrics.

---

### P7-05: Load & performance testing against documented targets

- **Depends on:** P7-01, P4-06
- **Implements:** `docs/PERFORMANCE/00-PERFORMANCE-REQUIREMENTS.md` .. `09-LOAD-TESTING.md`, `docs/TESTING/09-PERFORMANCE-TESTING.md`, `10-LOAD-TESTING.md`

**Steps**
1. Build a load test suite (e.g. k6/Gatling/Locust) exercising: sustained
   upload throughput, cold-cache transformation throughput (worst case:
   every request a cache miss), warm-cache delivery throughput, and a
   realistic mixed traffic profile.
2. Run against a staging environment sized like production (or a
   documented scaled-down equivalent with a documented scaling factor
   applied to the results).
3. Compare results against every numeric target in
   `docs/PERFORMANCE/00-PERFORMANCE-REQUIREMENTS.md`; for any target
   missed, either fix the bottleneck or revise the target with a recorded
   justification -- never silently leave a contradiction between the spec
   and reality.

**Definition of Done**
- [ ] Load test results are committed (or linked) in
      `MEMORY/records/P7-05.md` with pass/fail against every target.

---

### P7-06: Failure-injection & disaster recovery drill

- **Depends on:** P4-05, P2-11, P5-07
- **Implements:** `docs/TESTING/11-FAILURE-TESTING.md`, `docs/ARCHITECTURE/16-DISASTER-RECOVERY.md`, `docs/DEVOPS/11-DISASTER-RECOVERY.md`

**Steps**
1. Inject failures deliberately in a non-production environment: kill the
   Image Processing Service mid-burst, cut off the storage provider, cut
   off Redis, and observe whether the system degrades per spec (queueing,
   `503`s, stale-cache serving) rather than cascading.
2. Run one full disaster-recovery drill combining a database restore
   (`P2-11`) with a service redeploy, timing it against the RTO target.

**Definition of Done**
- [ ] Each injected failure's actual observed behavior is recorded against
      its documented expected behavior in `MEMORY/records/P7-06.md`,
      including any gaps found and whether they were fixed or logged as
      risk in `docs/PLAN/20-RISK-REGISTER.md`.

---

### P7-07: End-to-end test suite covering the full core promise

- **Depends on:** P6-05, P6-07
- **Implements:** `docs/TESTING/12-E2E-TESTING.md`, `docs/PLAN/19-ACCEPTANCE-CRITERIA.md`

**Steps**
1. Write the canonical E2E scenario: create tenant/application/project,
   issue an API key, upload an image, request three different derivatives
   (including one via `format=auto` and one via a signed URL), confirm a
   webhook fired for upload and processing, confirm cache-hit on repeat
   request.
2. Run this suite against a staging deployment on every release candidate,
   not just in an isolated test environment.

**Definition of Done**
- [ ] `docs/PLAN/19-ACCEPTANCE-CRITERIA.md` is Final, and every item on it
      is either covered by this E2E suite or another named automated test.

---

### P7-08: Developer documentation completion

- **Depends on:** P6-06, P6-07, P5-02, P6-04
- **Implements:** every document under `docs/DEVELOPER/`

**Steps**
1. Write `00-GETTING-STARTED.md` and `01-QUICKSTART.md` so a developer with
   zero prior context reaches one successful upload + one successful
   transformed fetch in under five minutes, with copy-pasteable code in at
   least two languages/SDKs.
2. Write task-oriented guides (`03-UPLOAD-IMAGE.md` through
   `08-WEBHOOKS.md`) each as a runnable example against the real API, not
   pseudocode.
3. Write `10-ERRORS.md` as the complete, current `error.code` reference
   (must match `P0-09`'s taxonomy exactly, kept in sync going forward) and
   `11-RATE-LIMITS.md` matching `P5-03`'s actual configured limits.

**Definition of Done**
- [ ] A person with no prior context on the project follows
      `01-QUICKSTART.md` verbatim and succeeds -- run this as a literal
      dry-run with someone who hasn't worked on the project, and record the
      friction points found in `MEMORY/records/P7-08.md`.

---

### P7-09: Launch readiness review

- **Depends on:** every task above
- **Implements:** `docs/PLAN/19-ACCEPTANCE-CRITERIA.md`, `docs/PLAN/20-RISK-REGISTER.md`

**Steps**
1. Walk `docs/PLAN/19-ACCEPTANCE-CRITERIA.md` line by line; every item is
   either checked off with a link to its proof (test, dashboard, drill
   record) or explicitly deferred with an owner and a target date in
   `docs/PLAN/20-RISK-REGISTER.md`.
2. Confirm every `docs/` file referenced by a completed task has been
   flipped from "Draft specification" to "Final" -- a leftover Draft file
   for a shipped feature is itself a launch-readiness gap.

**Definition of Done**
- [ ] `TASKS/PROGRESS.md` shows every P0-P7 task as Done or explicitly and
      knowingly deferred; nothing left silently incomplete.

---

---

### P7-10: Documentation site

- **Depends on:** P7-08
- **Implements:** `docs/WEBSITE/06-DOCS-SITE-PLAN.md`, `docs/WEBSITE/07-DOCS-CONTENT-PLAN.md`

The docs are the sales motion for this product: the primary audience decides
by reading, and the published protocol specification is the stated
differentiator. This task builds the site that carries both.

**Steps**
1. Choose the static generator against the ranked requirements in
   `docs/WEBSITE/06-DOCS-SITE-PLAN.md` -- weight requirement 4 (how easily
   it ingests *generated* content) above theme quality, and record the
   choice in `MEMORY/DECISIONS.md`.
2. Build `apps/website` with three route trees: `/` (landing, `P7-11`),
   `/docs`, and `/protocol`. One application, one design system, one
   deployment.
3. Wire the generated pages so they cannot drift: the parameter reference
   from `packages/transform-params`' registry, error codes from
   `packages/errors`, the API reference from the OpenAPI spec.
4. Render `/protocol` from `docs/IMAGE-DELIVERY-PROTOCOL/` with stable
   anchors, a version banner, and the downloadable conformance fixture from
   `P3-10`.
5. Write every page in `docs/WEBSITE/07-DOCS-CONTENT-PLAN.md`, including
   `/docs/responsive`, which has no `docs/` source yet -- write
   `docs/DEVELOPER/14-RESPONSIVE-IMAGES.md` first so the public page has a
   specification behind it like every other page.
6. Make every code sample a real file under `apps/website/samples/`,
   executed by the test suite and *included* into the page rather than
   pasted.

**Definition of Done**
- [ ] Every documentation code sample runs in CI against a live test
      project; a sample that does not run fails the build.
- [ ] No page documents unbuilt behaviour (`docs/WEBSITE/06` rules).
- [ ] The parameter reference, error codes, and API reference are generated,
      not hand-written, and a deliberate mismatch fails the build.
- [ ] `docs/WEBSITE/06-DOCS-SITE-PLAN.md` and `07-DOCS-CONTENT-PLAN.md`
      updated with the generator chosen and any IA deviation.

---

### P7-11: Landing page

- **Depends on:** P7-10, P3-02, P7-04
- **Implements:** `docs/WEBSITE/01-POSITIONING-AND-MESSAGING.md`, `02-LANDING-PAGE-STRUCTURE.md`, `03-LANDING-PAGE-COPY.md`, `04-VISUAL-DIRECTION.md`, `05-ASSET-SOURCING.md`

**Steps**
1. Confirm the Stage 0 blockers in `docs/WEBSITE/09-LAUNCH-CHECKLIST.md`
   are clear -- product name, `docs/PLAN/17-PRICING-ENTITLEMENT.md` Final, at
   least one real measurement, accent colour and typefaces, eight
   photographs with `credits.json` entries. Do not start without them; every
   one of them determines content that would otherwise be rewritten.
2. Build the sections in `docs/WEBSITE/02-LANDING-PAGE-STRUCTURE.md` with
   the copy in `03-LANDING-PAGE-COPY.md`, honouring the anti-generic rules
   in `04-VISUAL-DIRECTION.md`.
3. Build the live transformation panel -- the one bespoke component on the
   site, and the page's entire argument. It must call the real delivery path,
   read its numbers from real response headers, reserve its layout box, and
   degrade to a static real-numbers fallback with no JavaScript.
4. Constrain the panel's and `/migrate`'s abuse surface to a fixed allowlist
   of demo asset ids and parameter values, rate limited. An unconstrained
   public transformation endpoint is a free image-processing service for the
   internet.
5. Serve every image on the site through the platform itself, from the
   platform's own bucket, with `srcset` and `f=auto`, at widths drawn from
   `ADR-014`'s ladder.
6. Build `/pricing`, `/migrate`, `/credits`, `/changelog`, and `/legal/*`.

**Definition of Done**
- [ ] Every `[[N]]` placeholder in `docs/WEBSITE/03-LANDING-PAGE-COPY.md` is
      replaced by a measured number, or its section ships in the
      prose-only form. No invented figure ships, and no placeholder ships
      looking like a real number.
- [ ] Every PROOF line in the copy document is satisfied or the claim is
      removed.
- [ ] The Stage 2 truthfulness audit in
      `docs/WEBSITE/09-LAUNCH-CHECKLIST.md` is completed by someone who did
      not write the copy.
- [ ] `/credits` lists every image with photographer, source, licence, and
      a committed licence snapshot; an uncredited image fails the build.
- [ ] The migration claim is verified by running a real imgix URL and a real
      Cloudinary URL against the deployed platform.

---

### P7-12: Site performance, accessibility & SEO gates

- **Depends on:** P7-11
- **Implements:** `docs/WEBSITE/08-SEO-PERFORMANCE-A11Y.md`

A platform selling image delivery performance whose own pages are slow, or
whose own images are oversized, has published a counter-argument to itself --
and any prospect can verify it in thirty seconds with devtools. This task
makes that impossible to regress.

**Steps**
1. Add Lighthouse CI on `/`, `/docs`, `/docs/quickstart`, `/protocol`, with
   the numeric budgets from `docs/WEBSITE/08-SEO-PERFORMANCE-A11Y.md`
   (LCP <= 1.8 s, CLS <= 0.02, INP <= 120 ms, JS <= 45 KB, total <= 400 KB,
   Lighthouse >= 98). A regression fails the build, it is not a warning.
2. Add `axe-core` checks on the same routes, in both themes, zero
   violations.
3. Add the image dogfooding check: every site image delivered through the
   platform, none more than 1.5x its largest rendered width, total image
   bytes within budget.
4. Add the credits check, the link check, the code-sample execution, the
   quickstart end-to-end test, and HTML validation.
5. Run the manual pass in Stage 4 of
   `docs/WEBSITE/09-LAUNCH-CHECKLIST.md` -- keyboard-only, VoiceOver and
   NVDA, 200% zoom, 320px, both themes, a real mid-range Android phone,
   JavaScript disabled -- and record the results in the `MEMORY/` record.
6. Set security headers (CSP, HSTS, `X-Content-Type-Options`, referrer
   policy) and verify the CSP against the hero panel's own fetches.

**Definition of Done**
- [ ] All eight automated gates green and blocking in CI
      (`docs/DEVOPS/02-CI-CD.md`).
- [ ] The manual accessibility pass is completed and its findings are fixed,
      not deferred; automated tooling catches roughly a third of real
      issues, so the manual pass is the substantive one.
- [ ] Real-user Core Web Vitals are collected post-launch and compared
      against the lab budgets (Stage 6).
