# 13 - Security Coding Rules

> Category: **Engineering Conventions** (`docs/ENGINEERING/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

> **This document never relaxes a control.** `docs/SECURITY/` and
> `docs/MULTI-TENANCY/` define what must be true; this document says how to
> express that in code. Where the two appear to disagree, those categories
> win, and the disagreement is a bug in this file
> (`AGENTS.md` hard rule).

## Purpose

A multi-tenant image platform has a specific, short list of ways it gets
breached: a query that forgets a tenant, a signature compared with `===`, a
"just an image" upload that is actually an SVG with a script in it, and a
URL fetched on the server's behalf because a consumer asked nicely. This
document is the code-level countermeasure for each.

---

## 1. Tenant isolation

The full mechanism is in
[`07-REPOSITORY-DATABASE-STANDARDS.md`](./07-REPOSITORY-DATABASE-STANDARDS.md).
The rules, restated because this is where a reviewer looks:

- Every query on a tenant-owned table goes through `scoped()` (ADR-005).
- `ctx: TenantContext` is the first parameter of every repository and service
  function.
- `TenantContext` is built from the **verified credential only** -- never
  from a header, query parameter, body field, or path segment a caller
  controls. A tenant id a caller can influence is a cross-tenant primitive,
  no matter how many checks sit after it.
- `INSERT` takes its tenant and project from `ctx` and ignores any value in
  the payload.
- A cache key without a tenant id is a cross-tenant leak that the database
  layer's tests will never see (doc 08).
- A foreign-tenant resource returns `404` -- the same code, the same message,
  the same shape as a genuinely absent one
  (`docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`).
- Every `:id` route has the isolation test. `P1-06` makes it a CI gate.

Two checks, always: the permission gate proves the caller *may* do this kind
of thing; the scoped query proves *this row* is theirs. ADR-005 exists
because either alone is one bug from a leak.

## 2. Authentication and API keys

- **Store a hash, never the key.** API keys are hashed with a slow KDF
  (Argon2id or scrypt) or, where lookup performance requires it, an HMAC
  under a server-side pepper with the key id carried in the plaintext
  prefix. Never a bare SHA-256 of the key alone, and never the key itself.
- The key is shown to the user exactly once, at creation. There is no
  endpoint that returns it again -- if there were, the hash would be
  pointless.
- A key has a visible, non-secret prefix (`ak_live_01J...`) for
  identification in a UI and in logs, and a secret remainder. Log the
  prefix, never the remainder (doc 12).
- **Comparison is constant-time** (`crypto.timingSafeEqual`), on buffers of
  equal length, after a length check that does not itself leak. `===` on a
  credential is a timing oracle.
- Authentication failures are indistinguishable: "no such key" and "wrong
  secret" both yield `api_key_invalid`. Distinguishing them turns the
  endpoint into a key-enumeration oracle.
- Revocation is **immediate**: the cache entry is deleted synchronously
  (doc 08). A revoked key that works for five more minutes is a finding.
- Rate limiting is keyed on the authenticated identity, with a stricter
  anonymous bucket for unauthenticated attempts, so a brute force cannot use
  the anonymous path to avoid the limit.

## 3. Signed URLs

ADR-006, `docs/SECURITY/12-SIGNED-URL.md`,
`docs/IMAGE-DELIVERY-PROTOCOL/21-SIGNED-URL-PROTOCOL.md`, `22-URL-EXPIRATION.md`, `23-PRIVATE-IMAGE-DELIVERY.md`.

- HMAC-SHA256 over a **canonical** string:
  `method + path + sorted(params) + expiry`. Canonical is the operative
  word: if two representations of the same request produce two signature
  inputs, an attacker picks whichever one verification is weakest against.
  The canonicalization uses `packages/transform-params` -- the same
  normalization as everything else (ADR-004).
- Verification order: parse, check expiry, then compare the signature. Check
  expiry first so an expired URL never reaches the comparison, and use a
  constant-time comparison when it does.
- The signature covers **every** parameter that affects the response. A
  parameter outside the signature is a parameter an attacker can change --
  including one that makes the origin do more work than the signer intended.
- Per-application secrets, from the secret store, never from code, never
  from a log.
- Expiry is bounded by `DELIVERY_SIGNED_URL_MAX_TTL_SECONDS`. An unbounded
  TTL is a permanent grant.
- Clock skew tolerance is explicit and small. "A few seconds" must be a
  number in the config, not an accident of whichever clock is consulted.
- Every SDK produces byte-identical signatures, proven by the shared test
  vectors (`P6-06`). A signature scheme that differs per SDK is a scheme
  that will be verified permissively to compensate.

## 4. Upload and image handling

This is the attack surface unique to this platform. An image parser is a
large amount of C running on attacker-controlled bytes.

- **Validate content, not the extension or the declared MIME type.** Sniff
  magic bytes and confirm the decoder agrees. A `.png` that is actually an
  SVG, or an `image/jpeg` that is a zip, must be rejected.
- **SVG is not an image for these purposes.** It is a document that can
  carry script and external references. Either reject it, or store it and
  serve it only with `Content-Disposition: attachment` and a
  `Content-Security-Policy` that forbids script -- never rasterize
  attacker-supplied SVG in-process without a sandbox, and never serve it
  inline from the delivery domain. Which of these the platform does is a
  `docs/SECURITY/` decision; silently accepting and rasterizing it is not
  one of the options.
- **Bound everything before decoding**: byte size
  (`UPLOAD_MAX_BYTES`), pixel dimensions, and total pixel count. A 10 KB
  PNG can declare 50,000 x 50,000 pixels -- a decompression bomb that
  allocates gigabytes. libvips can report dimensions before full decode;
  check them and reject there.
- Set `sharp`'s limits explicitly: `limitInputPixels`, `sequentialRead`,
  and a page limit for animated formats. Never rely on the library's
  defaults for a security bound.
- **Strip metadata by default.** EXIF carries GPS coordinates and device
  identifiers; a platform that passes them through re-publishes its
  consumers' users' location data. Preserving metadata is opt-in, per
  `docs/IMAGE-PROCESSING/`, and orientation is applied before stripping so
  the image is not silently rotated.
- Process in a resource-bounded worker with a timeout and a memory ceiling
  (ADR-007). A decode that hangs must not take the process with it.
- The uploaded filename is untrusted input: never used as a path, never
  echoed into a header unencoded, never used to derive an object key. Object
  keys come from `docs/STORAGE/04-OBJECT-NAMING.md`.
- **Never fetch a URL on a consumer's behalf without an SSRF guard.** If
  fetch-from-URL ingestion exists, it needs: an allowlist or a
  deny-by-default resolver that rejects private, link-local, and metadata
  addresses (`169.254.169.254` above all); DNS re-resolution after redirect;
  a redirect limit; a response size limit; and a timeout. A naive
  implementation is a read primitive against the cloud metadata service.

## 5. Output and delivery

- The delivery response's `Content-Type` comes from what was actually
  produced, never from the request or the stored declaration.
- `X-Content-Type-Options: nosniff` on every response.
- User-controlled metadata echoed into a header is encoded, and a newline in
  it is rejected -- header injection otherwise.
- The public delivery domain is separate from the dashboard's origin, so
  stored content cannot script against a session
  (`docs/CDN/`, `docs/SECURITY/`).
- Error responses reflect no unsanitized input (doc 06).
- `Cache-Control` on an error is explicit, so an edge does not cache a 500
  for an hour.

## 6. Secrets

- Never in the repository, never in a default value, never in a log, never
  in an error message.
- Loaded at startup through `packages/config`; the process exits non-zero if
  one is missing (section 19 of
  [`01-CODING-STANDARDS.md`](./01-CODING-STANDARDS.md)).
- A secret in git history is compromised even after the commit is reverted.
  Rotate first, then clean the history.
- Secret scanning runs in CI (`P0-10`).
- Per `docs/DEVOPS/04-SECRETS-MANAGEMENT.md` for delivery and rotation.

## 7. Dependencies

- A new dependency is an ADR, especially on a security path. "It has a lot
  of stars" is not a review.
- Lockfile committed; CI installs `--frozen-lockfile`.
- `pnpm audit` in CI (`P0-10`); a high-severity advisory on a reachable path
  blocks the merge.
- Prefer the platform: `node:crypto` over a hashing library, `AbortSignal`
  over a timeout library. Fewer dependencies on the credential path is the
  goal.

## 8. Cryptography

- Use `node:crypto`. Do not implement a primitive.
- `crypto.randomBytes` / `crypto.randomUUID` for anything unguessable.
  `Math.random()` is never acceptable for a token, a key, an id, or a nonce.
- `crypto.timingSafeEqual` for every secret comparison.
- ULIDs are for identifiers, not for secrets: they are sortable and
  timestamp-bearing, which makes them predictable enough to never use as a
  capability. A "secret" URL containing only a ULID is not access control
  (ADR-003 says so explicitly).

## What to do when this conflicts with a task

`AGENTS.md`: the specification wins until it is deliberately changed. A
shortcut here is the most expensive shortcut this platform can take.
Concretely:

1. If `docs/SECURITY/` is wrong or under-specified, fix that document first,
   in the same change, with a `MEMORY/DECISIONS.md` entry.
2. If the task cannot be done without weakening a control, mark it
   `Blocked` in `TASKS/PROGRESS.md` with the reason and move to the next
   task.
3. Never merge with an "I'll fix the security part later" note.
   `TASKS/00-TASK-CONVENTIONS.md` does not permit it, and the note outlives
   the intent.

## Acceptance Criteria

- [x] Each rule names the concrete attack it prevents, so a reader can
      judge a variation on it rather than pattern-matching.
- [x] Every rule traces to `docs/SECURITY/`, `docs/MULTI-TENANCY/`, or an
      ADR; none originates here.
- [x] The upload section covers content sniffing, decompression bombs,
      metadata stripping, SVG, and SSRF explicitly.

## Open Questions

- The SVG decision (reject outright versus store-and-serve-as-attachment)
  belongs to `docs/SECURITY/` and `docs/PLAN/02-PRODUCT-SCOPE.md`; this
  document tracks whatever they decide.
- The API key hashing scheme (slow KDF versus peppered HMAC) is settled in
  `P1-02`, where the lookup-performance trade-off is real.
- Whether fetch-from-URL ingestion exists in v1 at all is a
  `docs/PLAN/02-PRODUCT-SCOPE.md` question. If it does not, the SSRF guard
  is still specified here so it cannot be added later without one.
- Pixel and dimension ceilings are numbers that belong in
  `docs/PLAN/15-QUOTA-LIMITS.md`; the constants reference them.

## Related Documents

- `docs/SECURITY/` (the whole category -- normative)
- `docs/MULTI-TENANCY/08-CROSS-TENANT-PROTECTION.md`
- `docs/SECURITY/11-IDOR-BOLA-PREVENTION.md`, `12-SIGNED-URL.md`
- `docs/IMAGE-PROCESSING/` (decoder limits, metadata handling)
- `docs/IMAGE-DELIVERY-PROTOCOL/21-SIGNED-URL-PROTOCOL.md`, `22-URL-EXPIRATION.md`, `23-PRIVATE-IMAGE-DELIVERY.md` (signed-URL protocol framing)
- `docs/DEVOPS/04-SECRETS-MANAGEMENT.md`
- `MEMORY/DECISIONS.md` (`ADR-003`, `ADR-004`, `ADR-005`, `ADR-006`, `ADR-007`)
- `TASKS/PHASE-5-SECURITY-HARDENING.md`
