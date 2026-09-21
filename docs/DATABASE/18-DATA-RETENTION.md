# 18 - Data Retention

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1 -- durations are defaults pending PLAN/16-17) &nbsp;|&nbsp; Owner: TBD

## Purpose

How long each kind of data is kept after it stops being live, and which job
removes it. Every duration is a configuration value with the default below;
per-plan values (`docs/PLAN/17` lists the retention window as an
entitlement) override the default once the plans are final.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

## Retention table

| Data | Clock starts | Default | Config key | Removed by |
|---|---|---|---|---|
| Soft-deleted asset (row, versions, derivatives, objects) | `assets.deleted_at` | 30 days | `RETENTION_DELETED_ASSET_DAYS` | `purge-deleted-assets` (`P2-08`) |
| Superseded asset version (not current, asset live) | when superseded | 30 days | `RETENTION_OLD_VERSION_DAYS` | `purge-old-versions` (`P2-05`) |
| Derivative of a superseded version | when superseded | immediately stale; deleted within 1 day | -- | `expire-derivatives` |
| Pending upload that never completed | `assets.created_at` | 24 hours | `RETENTION_PENDING_UPLOAD_HOURS` | `sweep-pending-uploads` (`P2-03`) |
| Soft-deleted folder, tag, collection | `deleted_at` | 30 days | `RETENTION_DELETED_ASSET_DAYS` | `purge-deleted-assets` |
| Webhook delivery attempt | `attempted_at` | 30 days | `RETENTION_WEBHOOK_DELIVERY_DAYS` | retention job (`P6-04`) |
| Usage day | `day` | 400 days (13 months, a full year-over-year) | `RETENTION_USAGE_DAYS` | retention job (`P1-08`) |
| Audit log entry | `created_at` | 365 days | `RETENTION_AUDIT_DAYS` | retention job, with `image_delivery.audit_purge` (`P1-07`) |
| Idempotency key | creation | 24 hours | -- | TTL (`P2-02`, `docs/ENGINEERING/08`) |
| Deleted tenant (everything above, plus the tenant row) | deletion request | 30 days, then purged; CDN purged | `RETENTION_DELETED_TENANT_DAYS` | tenant purge (`SEC-PRV-01`, `P5`) |

## Rules

- **Restore is possible only inside the window.** After it, the API answers
  `410 asset_purged` (`docs/API/05`), never a silent 404.
- Purge order is objects first, then rows, so a crash between the two
  leaves a row pointing at nothing (retried) rather than an object nobody
  can find.
- Backups (`docs/DEVOPS/07`) keep purged data until they expire; the backup
  retention is stated there, and a restore re-applies purges that happened
  after the backup was taken.
- Audit entries are the only rows removed under the audit guard; the purge
  runs in its own transaction with the setting local to it.

## Acceptance Criteria

- [x] Every retention rule names its clock, default, configuration key and
      removing job.
- [ ] Per-plan values confirmed against `docs/PLAN/16` and `17` (business
      input; the defaults above apply until then).

## Related Documents

- `docs/PLAN/16-RETENTION-POLICY.md`, `docs/PLAN/17-PRICING-ENTITLEMENT.md`
- `docs/SECURITY/18-DATA-PRIVACY.md` (`SEC-PRV-01`)
- `docs/DEVOPS/07-BACKUP.md`
