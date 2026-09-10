# Storage

Storage is abstracted behind an internal interface so the object storage provider (S3, R2, GCS, MinIO, Azure Blob) can be swapped without any consumer-facing change. These documents define that abstraction, bucket and object-naming strategy, lifecycle, replication, backup, and cost control.

## Documents

- [`00-STORAGE-ARCHITECTURE.md`](./00-STORAGE-ARCHITECTURE.md) -- Storage Architecture
- [`01-STORAGE-ABSTRACTION.md`](./01-STORAGE-ABSTRACTION.md) -- Storage Abstraction
- [`02-OBJECT-STORAGE.md`](./02-OBJECT-STORAGE.md) -- Object Storage
- [`03-BUCKET-STRATEGY.md`](./03-BUCKET-STRATEGY.md) -- Bucket Strategy
- [`04-OBJECT-NAMING.md`](./04-OBJECT-NAMING.md) -- Object Naming
- [`05-STORAGE-LIFECYCLE.md`](./05-STORAGE-LIFECYCLE.md) -- Storage Lifecycle
- [`06-STORAGE-REPLICATION.md`](./06-STORAGE-REPLICATION.md) -- Storage Replication
- [`07-STORAGE-BACKUP.md`](./07-STORAGE-BACKUP.md) -- Storage Backup
- [`08-STORAGE-RESTORE.md`](./08-STORAGE-RESTORE.md) -- Storage Restore
- [`09-STORAGE-COST-CONTROL.md`](./09-STORAGE-COST-CONTROL.md) -- Storage Cost Control
- [`10-STORAGE-PROVIDER-ADAPTER.md`](./10-STORAGE-PROVIDER-ADAPTER.md) -- Storage Provider Adapter
