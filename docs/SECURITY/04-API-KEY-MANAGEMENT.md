# 04 - API Key Management

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

The full lifecycle of an API key: how it is formed, issued, stored,
verified, rotated and revoked -- and what the platform never does with it.
Implements `SEC-AUTH-01` .. `05` and `SEC-PRV-02` of
[`00-SECURITY-REQUIREMENTS.md`](./00-SECURITY-REQUIREMENTS.md).

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

---

## Format

```
ak_live_01J8Z3K4M5N6P7Q8R9S0T1V2W3_q7Xc0cKf2Qn9V-1s3oZkqj0l8m2nBv6x4AR5eT9uYw0
\/ \__/ \________________________/ \_________________________________________/
 |   |        key id (ULID)                  secret: 32 random bytes, base64url
 |   environment: live | test
 prefix
```

| Part | Secret? | Where it appears |
|---|---|---|
| `ak_<env>_<id>` | no | dashboard listings, logs, audit entries, support conversations |
| the 43-character secret | **yes** | only in the create/rotate response, once |

The environment is visible so a test key used in production is noticed.
The id is the row's primary key, which lets authentication find the row by
index; the tenant comes *out* of the row, never from the request.

## Storage

- Only `HMAC-SHA256(API_KEY_PEPPER, id + "." + secret)` is stored (hex,
  `api_keys.key_hash`, unique). Binding the id into the MAC means a stored
  hash cannot be moved to another row.
- Why not Argon2/bcrypt (ADR-022 point 4): the secret has 256 bits of
  entropy, so there is nothing for a slow KDF to protect against, and a slow
  KDF on every request is a self-inflicted denial of service.
- The pepper is a deployment secret (`docs/DEVOPS/04`); without it a stolen
  database cannot verify any key guess.
- No column, log line, error, or response after creation contains the
  secret. Verified by a test that reads the raw row (`api-keys.int.test.ts`).

## Issuance

- `create(ctx, applicationId, { name, environment, permissions,
  all_projects | project_ids })`. Coverage is always explicit: every
  project of the application, or a listed subset that the database forces
  to be in that application (`api_key_projects_project_fk`).
- The very first key of a new installation comes from the operator command
  `provision` (`node dist/provision.js`), which creates the tenant, its
  first application and project, and a bootstrap key scoped to key
  management. Every other key is issued through the API by a key or user
  that holds `api-key:create` (`P1-03`/`P1-04`).

## Verification (authentication)

1. Parse; a malformed value fails without a database round trip.
2. Look the row up by id (the one pre-tenant query, reason
   `authenticate-credential`).
3. Always compute one HMAC and one constant-time comparison -- against a
   decoy hash when no row exists -- so timing does not reveal whether an id
   exists.
4. Refuse unless: the secret matches; the environment in the key matches
   the row; the key is `active` and not past `expires_at`; its application
   and tenant are `active` and not deleted.
5. Every refusal is the same answer: `401 api_key_invalid` (`SEC-AUTH-04`).

## Rotation

`rotate(ctx, applicationId, keyId, { overlap_seconds })` issues a new key
with the same name, permissions and coverage, and sets the old key's
`expires_at` to now + overlap (default 24 hours, at most 7 days; an earlier
expiry is kept). Both keys work during the overlap, so a deployment can
switch without downtime. Only an `active` key can be rotated
(`409 invalid_state`).

## Revocation

- `revoke(ctx, applicationId, keyId)` is permanent and **immediate**: every
  authentication reads the row, so the next request fails
  (`SEC-AUTH-05`, tested). A credential cache added later must delete its
  entry synchronously in the same operation.
- Idempotent: revoking a revoked key changes nothing.
- A platform operator can revoke any key (`SEC-PRV-02`) through the admin
  surface (`docs/API/20`).
- `suspended` is a temporary operator hold (`P5-05`) with the same effect on
  authentication.

## Usage tracking

`last_used_at` is written in batches -- at most once a minute per process,
one statement for every key seen -- never on the request path. A crash
loses at most one interval of this hygiene signal.

## Tenant isolation

Every management operation takes the tenant from the caller's context and
runs through `scoped()`. Another tenant's key id is `404 api_key_not_found`,
identical to an id that does not exist, and changes nothing (tested).

## Acceptance Criteria

- [x] Every default is stated: secret size, format, overlap default and
      maximum, flush interval.
- [x] Every rule is tested (`api-key.crypto.test.ts`,
      `last-used-tracker.test.ts`, `api-keys.int.test.ts`,
      `provisioning.int.test.ts`).
- [x] Cross-references: `docs/DATABASE/13`, `docs/API/02`, `SECURITY/00`.

## Related Documents

- `docs/DATABASE/13-API-KEYS.md`
- `docs/API/02-AUTHENTICATION.md`
- `docs/SECURITY/00-SECURITY-REQUIREMENTS.md` (`SEC-AUTH-*`)
- `MEMORY/DECISIONS.md` (`ADR-022` point 4)
