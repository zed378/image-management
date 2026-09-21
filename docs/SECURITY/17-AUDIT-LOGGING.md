# 17 - Audit Logging

> Category: **Security** (`docs/SECURITY/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

An append-only record of security-relevant actions -- who did what, to
what, when, from where -- that a tenant can inspect and nobody, including
the application, can rewrite. Implements `SEC-SEC-04`. Storage is
[`docs/DATABASE/17-AUDIT-LOGS.md`](../DATABASE/17-AUDIT-LOGS.md).

## Category Mandate

Covers authentication, authorization, the platform's threat model, and the
controls that defend against IDOR/BOLA, malicious uploads, credential abuse,
and denial of service. Security documents take precedence over convenience:
if a feature specification and a security document conflict, the security
document wins until the conflict is explicitly resolved and recorded.

---

## What is audited

The closed vocabulary (`services/api/src/modules/audit/audit.ts`,
`AUDIT_ACTIONS`); a new action is a reviewed change.

| Action | Written by | Since |
|---|---|---|
| `api_key.created`, `api_key.rotated`, `api_key.revoked` | API-key service | `P1-07` |
| `tenant.provisioned` | `provision` command | `P1-07` |
| `api_key.suspended` | operator hold | `P5-05` |
| `role.granted`, `role.revoked` | member management | `P6-11` |
| `asset.visibility_changed` | asset service | `P5-01` |
| `asset.purged` (hard delete) | purge job | `P2-08` |
| `tenant.settings_updated`, `quota.override_set`, `admin.access` | admin surface | `P7` / `docs/API/20` |

Each entry: actor (type and id; `system` for jobs, `platform_admin` for
operators -- recorded under the affected tenant so the tenant sees it),
action, target, application/project context, request id, client address,
and a small metadata object. **Never** a secret, a credential or a
plaintext key (tested).

## Guarantees

1. **The change and its record are one transaction.** Audited changes go
   through `audited(db, ctx, work)`: the work must *return* its audit
   entries, which are written in the same transaction. A failing change
   records nothing; a failing record undoes the change (both tested). A
   service cannot perform an audited change and forget the record, because
   the record is the return type -- this is the "base layer" the task asks
   for, rather than a per-endpoint afterthought.
2. **Immutable, in the database.** The `audit_logs_guard` trigger rejects
   UPDATE, and DELETE/TRUNCATE outside the retention purge
   (`docs/DATABASE/17`). Independently, the application's role
   `image_delivery_app` has only INSERT and SELECT on the table
   (migration `20260921T1600_create_app_role`), so even a bug or an
   injected statement in the application cannot alter the trail (tested by
   connecting as a member of that role).
3. **Idempotent actions are recorded once.** A repeated revoke changes
   nothing and writes nothing.
4. **Retained** 365 days by default (`docs/DATABASE/18`), purged only by the
   retention job under `image_delivery.audit_purge`.

## Acceptance Criteria

- [x] Every audited action, and when it starts being written, is listed.
- [x] Immutability is proven for both the trigger and the role grant.

## Related Documents

- `docs/DATABASE/17-AUDIT-LOGS.md`, `18-DATA-RETENTION.md`
- `docs/DEVOPS/04-SECRETS-MANAGEMENT.md` (database roles)
- `docs/SECURITY/00-SECURITY-REQUIREMENTS.md` (`SEC-SEC-04`)
