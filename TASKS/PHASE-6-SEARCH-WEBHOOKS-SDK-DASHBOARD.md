# Phase 6 -- Search, Webhooks, SDKs & Dashboard

Goal: everything a real integrating developer needs beyond raw CRUD +
transformation: discoverability, async notifications, typed clients, and a
usable admin surface.

Exit criteria: assets are filterable/sortable/paginated correctly at scale;
webhook events fire reliably with signed payloads and retries; a
TypeScript SDK and at least one framework integration exist; the dashboard
covers asset browsing, key management, and usage.

---

### P6-01: Search & filter API

- **Depends on:** P2-06
- **Implements:** `docs/API/16-SEARCH-API.md`, `docs/SEARCH/00-SEARCH-ARCHITECTURE.md` .. `07-SORTING.md`

**Steps**
1. `GET /v1/assets?folder=&tag=&format=&width_min=&width_max=&created_after=...`:
   define the filter grammar, back every filterable field with an index
   (or explicitly document it as unsupported/slow).
2. Implement `sort=` with a stable tie-breaker (unique column) so
   pagination (below) cannot skip or repeat rows under concurrent writes.
3. If full-text metadata search is in v1 scope, integrate a search index
   (e.g. Postgres full-text or an external engine) -- decide and record in
   `MEMORY/DECISIONS.md`; if out of scope for v1, say so explicitly in
   `docs/SEARCH/00-SEARCH-ARCHITECTURE.md`.

**Definition of Done**
- [ ] `docs/SEARCH/06-FILTERING.md` and `07-SORTING.md` are Final and every
      filter field's index is verified to exist via `EXPLAIN`.

---

### P6-02: Cursor-based pagination

- **Depends on:** P6-01
- **Implements:** `docs/API/07-PAGINATION.md`, `docs/SEARCH/08-PAGINATION.md`

**Steps**
1. Implement cursor (keyset) pagination, not offset -- offset pagination
   degrades badly at scale and shifts under concurrent inserts/deletes.
2. Standardize the envelope (`data`, `page.next_cursor`, `page.has_more`)
   across every list endpoint in the API, not just assets.

**Definition of Done**
- [ ] A test inserts a row between two paginated requests and confirms no
      row is skipped or duplicated across the page boundary.

---

### P6-03: Webhook subscription management

- **Depends on:** P1-04
- **Implements:** `docs/DATABASE/16-WEBHOOKS.md`, `docs/API/09-WEBHOOKS.md`, `docs/WEBHOOK/00-WEBHOOK-ARCHITECTURE.md`

**Steps**
1. CRUD for webhook endpoints per application: URL, subscribed event
   types, a generated HMAC secret (shown once, like API keys).
2. Validate the target URL at creation time (reachable, not pointing at a
   private/internal address -- same SSRF discipline as `P2-04`).

**Definition of Done**
- [ ] Creating a webhook pointed at an internal/private address is
      rejected, tested (mirrors the `P2-04` SSRF test suite).

---

### P6-04: Webhook delivery worker + signing + retry

- **Depends on:** P6-03
- **Implements:** `docs/WEBHOOK/06-WEBHOOK-SECURITY.md`, `07-WEBHOOK-RETRY.md`, `docs/ARCHITECTURE/12-QUEUE-WORKER-ARCHITECTURE.md`

**Steps**
1. Deliveries run entirely off a queue, in a worker, never synchronously
   from the event source (upload/processing/deletion code paths only
   enqueue, they never block on an HTTP call to a third party).
2. Sign every payload: `X-Signature: HMAC-SHA256(secret, timestamp + "." +
   body)`, include a timestamp header, document the exact verification
   recipe for receivers (mirrors `docs/SECURITY/12-SIGNED-URL.md`'s
   rigor).
3. Retry schedule: exponential backoff with jitter, capped attempts (e.g.
   5) over a bounded window (e.g. ~1 hour); persist every attempt in
   `webhook_deliveries` with status and response code for the tenant to
   inspect; move to a dead-letter state after final failure.

**Definition of Done**
- [ ] A receiver that returns `500` on the first two attempts and `200` on
      the third succeeds end to end in an integration test, with the two
      failed attempts visible via the deliveries API.

---

### P6-05: Wire the four core events end to end

- **Depends on:** P6-04, P2-02, P3-08, P2-08, P2-05
- **Implements:** `docs/WEBHOOK/01-ASSET-UPLOADED.md` .. `05-ASSET-UPDATED.md`

**Steps**
1. `asset.uploaded` fires from `P2-02`'s success path; `processing.completed`
   / `processing.failed` from `P3-08`; `asset.deleted` from `P2-08`;
   `asset.updated` from `P2-05`/`P2-06`.
2. Fix and document each payload's exact shape (diff-only for `updated`,
   per `docs/WEBHOOK/05-ASSET-UPDATED.md`'s existing guidance).

**Definition of Done**
- [ ] Each of the five event docs is Final with a real, example JSON
      payload matching the actual emitted shape.

---

### P6-06: TypeScript SDK

- **Depends on:** P1-02, P2-02, P3-08
- **Implements:** `docs/SDK/00-SDK-STRATEGY.md`, `02-TYPESCRIPT-SDK.md`

**Steps**
1. Generate or hand-write fully-typed request/response models from the
   API contract (keep in lockstep -- prefer generating from an OpenAPI
   spec derived from `docs/API/` if the framework supports it, to avoid
   drift).
2. Cover: authentication, asset CRUD, upload (multipart + presigned),
   transformation URL building (client-side, no network call needed to
   build a delivery URL), signed-URL generation matching `P5-02`'s
   algorithm exactly.
3. Publish to the package registry (or document the internal publish
   process) with semantic versioning tied to API version changes.

**Definition of Done**
- [ ] SDK-generated signed URLs are verified byte-identical to
      server-generated ones for the same inputs, tested against `P5-02`'s
      test vectors.

---

### P6-07: React `<Image/>` component + client-side image package

- **Depends on:** P6-06
- **Implements:** `docs/SDK/07-CLIENT-SIDE-IMAGE.md`, `03-REACT-INTEGRATION.md`, `04-NEXTJS-INTEGRATION.md`, `docs/IMAGE-DELIVERY-PROTOCOL/13-DPR-AND-RESPONSIVE-IMAGES.md`, `14-SRCSET-AND-SIZES.md`

**Steps**
1. Build `<Image assetId width height fit position .../>` that resolves to
   a delivery URL client-side with `format=auto` applied by default (per
   the worked example in `docs/SDK/07-CLIENT-SIDE-IMAGE.md`).
2. Support responsive `srcset` generation (multiple DPR/width variants) and
   lazy loading by default.
3. Provide a Next.js `loader` function for interop with Next's built-in
   `<Image/>` as an alternative integration path.

**Definition of Done**
- [ ] `docs/SDK/07-CLIENT-SIDE-IMAGE.md` is Final and its example resolves,
      verified by a test, to exactly the documented URL shape.

---

### P6-08: PHP & Go SDKs (minimal, server-side use cases)

- **Depends on:** P6-06
- **Implements:** `docs/SDK/05-PHP-SDK.md`, `06-GO-SDK.md`

**Steps**
1. Scope these to server-side needs only for v1 (auth, signed-URL
   generation, asset CRUD) -- no client-side component expected in these
   languages.
2. Reuse the exact signing algorithm test vectors from `P5-02`/`P6-06` to
   keep all SDKs provably compatible with each other.

**Definition of Done**
- [ ] Each SDK's signed-URL output passes the shared cross-language test
      vector suite.

---

### P6-09: Dashboard -- information architecture & auth

- **Depends on:** P1-04
- **Implements:** `docs/UI-UX/00-DESIGN-DIRECTION.md`, `01-INFORMATION-ARCHITECTURE.md`

**Steps**
1. Map every planned screen to the API endpoints it calls (no screen
   without a backing endpoint already built in an earlier phase).
2. Stand up dashboard authentication (session-based, separate from API-key
   auth used by consumer applications) per `docs/SECURITY/03-AUTHENTICATION.md`.

**Definition of Done**
- [ ] `docs/UI-UX/01-INFORMATION-ARCHITECTURE.md` is Final before any
      screen-level UI work starts.

---

### P6-10: Dashboard -- asset manager, upload UX, preview

- **Depends on:** P6-09, P2-06, P2-02
- **Implements:** `docs/UI-UX/04-ASSET-MANAGER.md`, `05-UPLOAD-UX.md`, `06-IMAGE-PREVIEW.md`

**Steps**
1. Grid/list asset browser with folder navigation, search/filter (backed
   by `P6-01`), bulk actions (backed by `P2-10`).
2. Upload UX using the presigned flow (`P2-03`) for large files, progress
   feedback, and validation error display using the real error codes from
   `P0-09`/`P2-02`.
3. Live transformation preview: adjust width/fit/quality and see the
   result plus the generated URL, ready to copy.

---

### P6-11: Dashboard -- API keys, webhooks, usage & settings

- **Depends on:** P6-09, P1-02, P6-03
- **Implements:** `docs/UI-UX/08-API-KEY-MANAGEMENT.md`, `09-USAGE-ANALYTICS.md`, `10-SETTINGS.md`

**Steps**
1. Key management screen: create (show-once plaintext), list (hash-derived
   identifier only), rotate, revoke.
2. Usage screen backed by `docs/DATABASE/14-USAGE.md`'s rollups, broken
   down by project and metric, against the plan's quota.
3. Webhook management screen (CRUD from `P6-03` plus delivery history from
   `P6-04`).

**Definition of Done for P6-10 and P6-11**
- [ ] Every dashboard screen calls only endpoints that exist and are
      already covered by their own tests -- no dashboard-only backend logic
      introduced outside the documented API/ contract.

---
