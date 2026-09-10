# Phase 5 -- Security Hardening

Goal: close the remaining gaps between "isolation and auth work" (Phase 1)
and "the platform is defensible against a motivated attacker" -- signed
URLs for private assets, rate limiting, abuse prevention, and a real
incident-response plan.

Exit criteria: private assets are unreachable without a valid, unexpired
signature; every endpoint is rate-limited with a documented, tested policy;
a threat-model review has been performed against the shipped surface, not
just the planned one.

---

### P5-01: Asset visibility levels

- **Depends on:** P2-06, P4-04
- **Implements:** `docs/PLAN/21-ASSET-VISIBILITY.md`, `docs/IMAGE-DELIVERY-PROTOCOL/23-PRIVATE-IMAGE-DELIVERY.md`

**Steps**
1. Implement `PUBLIC`, `PRIVATE`, `UNLISTED`, `SIGNED`, `EXPIRING` as an
   enum on `assets` (or `asset_versions`, if visibility can change per
   version -- decide and document which).
2. `PRIVATE` requires an authenticated session/key with resource access
   (dashboard-style); `UNLISTED` requires knowing the (unguessable) URL but
   no signature; `SIGNED`/`EXPIRING` require a valid signature checked at
   both origin and, per `P4-03`, respected by CDN TTL.
3. Delivery API enforces visibility on every request -- this is a security
   control, not just a filter, so it lives in the same code path as
   isolation checks, reviewed with the same rigor.

**Definition of Done**
- [ ] Every visibility level has a positive test (correct access works) and
      a negative test (incorrect access is denied) per the `P1-06` gate
      pattern.

---

### P5-02: Signed URL generation & verification

- **Depends on:** P5-01
- **Implements:** `docs/SECURITY/12-SIGNED-URL.md`, `docs/API/14-IMAGE-DELIVERY-API.md`, `docs/IMAGE-DELIVERY-PROTOCOL/21-SIGNED-URL-PROTOCOL.md`, `22-URL-EXPIRATION.md`

**Steps**
1. Implement HMAC-SHA256 signing: canonical string = method + path +
   sorted transformation params + expiry timestamp, signed with a
   per-application secret (rotatable, stored via `packages/config`
   secrets loading from `P0-04`).
2. `expires` is a Unix timestamp; verification rejects if expired or if the
   signature doesn't match the canonical string recomputed server-side --
   constant-time comparison to avoid timing attacks.
3. Publish the exact signing algorithm in `docs/SECURITY/12-SIGNED-URL.md`
   precisely enough that `packages/*-sdk` (Phase 6) can implement it
   independently and produce byte-identical signatures.

**Definition of Done**
- [ ] A tampered parameter (even one that would otherwise still resolve to
      a valid image, e.g. changing `w=800` to `w=801`) invalidates the
      signature, tested.
- [ ] Signature comparison is constant-time, verified by code review noted
      in `MEMORY/records/P5-02.md`.

---

### P5-03: Rate limiting

- **Depends on:** P1-03
- **Implements:** `docs/API/06-RATE-LIMITING.md`, `docs/SECURITY/15-RATE-LIMITING.md`, `docs/IMAGE-DELIVERY-PROTOCOL/33-RATE-LIMITS.md`

**Steps**
1. Token-bucket (or equivalent) rate limiter at the API Gateway, keyed by
   API key (authenticated traffic) and by IP (unauthenticated/public
   delivery traffic), with limits configurable per plan tier.
2. Return `429` with `Retry-After` and a `X-RateLimit-*` header set,
   documented in `docs/API/06-RATE-LIMITING.md`.
3. Ensure the limiter state (Redis-backed) is itself tenant-partitioned so
   one tenant's burst cannot exhaust shared rate-limit infrastructure
   capacity for another (a fairness concern, not just a correctness one).

**Definition of Done**
- [ ] A burst past the configured limit reliably returns `429` with correct
      headers, tested; traffic from a different key/IP is unaffected by
      another key's burst, tested.

---

### P5-04: Malicious file & upload hardening

- **Depends on:** P2-02
- **Implements:** `docs/SECURITY/14-MALICIOUS-FILE-PREVENTION.md`

**Steps**
1. Run image decoding in a sandboxed/resource-limited context (separate
   process or container with memory/CPU/time limits) so a crafted
   malformed file cannot exhaust host resources or exploit a decoder
   vulnerability against the main service process.
2. Add antivirus/malware scanning on upload if required by the platform's
   compliance target (document the decision either way).
3. Re-run the image-bomb and malformed-file test corpus from `P2-02`
   against the sandboxed path to confirm the hardening holds.

**Definition of Done**
- [ ] A known malformed-file test corpus (pixel-flood, decompression bomb,
      polyglot file) is exercised in CI against the upload path.

---

### P5-05: Abuse prevention

- **Depends on:** P5-03
- **Implements:** `docs/SECURITY/16-ABUSE-PREVENTION.md`, `docs/IMAGE-DELIVERY-PROTOCOL/34-ABUSE-PREVENTION.md`

**Steps**
1. Detect and mitigate hotlinking/bandwidth theft: optional referrer
   allow-listing per application, configurable in the dashboard (`P6`).
2. Detect transformation-parameter fuzzing used to bust cache and burn
   processing compute (e.g. requesting thousands of near-identical
   dimensions): cap the number of distinct derivative sizes generated per
   asset per time window, or apply stricter rate limiting to
   cache-miss-triggering requests specifically.
3. Add a temporary key-suspension mechanism for clearly abusive traffic,
   usable by platform admins via the Admin API.

**Definition of Done**
- [ ] `docs/SECURITY/16-ABUSE-PREVENTION.md` is Final, naming the specific
      detection thresholds chosen (not left as "TBD" -- pick real starting
      numbers, they can be tuned later, and record the initial choice as a
      decision in `MEMORY/DECISIONS.md`).

---

### P5-06: Threat model review against the shipped system

- **Depends on:** P5-01..P5-05
- **Implements:** `docs/SECURITY/01-THREAT-MODEL.md`, `docs/SECURITY/02-TRUST-BOUNDARIES.md`

**Steps**
1. Re-run the STRIDE-style review from `docs/SECURITY/01-THREAT-MODEL.md`
   against the actual, shipped trust boundaries (not the originally
   planned ones -- note every place implementation diverged from the plan).
2. For every threat identified with no mitigation yet in place, either
   implement one now or explicitly log it in `docs/PLAN/20-RISK-REGISTER.md`
   with an owner and target date.

**Definition of Done**
- [ ] `docs/SECURITY/01-THREAT-MODEL.md` and `02-TRUST-BOUNDARIES.md` are
      Final and dated as reviewed against the real system.

---

### P5-07: Incident response runbook

- **Depends on:** P5-06
- **Implements:** `docs/SECURITY/19-INCIDENT-RESPONSE.md`

**Steps**
1. Write concrete runbooks for the platform's specific top incidents:
   signed-URL secret leak (rotation procedure + how fast old signatures
   stop working), cross-tenant data exposure (containment + tenant
   notification process), storage provider outage (failover per `P4-05`),
   CDN cache poisoning.
2. Define severity levels and the on-call escalation path.

**Definition of Done**
- [ ] At least one runbook (recommend: signed-URL secret rotation) has been
      dry-run in a non-production environment, timed, and the result
      recorded in `MEMORY/records/P5-07.md`.

---
