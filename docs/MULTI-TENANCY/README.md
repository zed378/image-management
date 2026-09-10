# Multi-Tenancy

The platform is consumed by many independent applications (tenants), each with its own assets, quotas, and CDN configuration. Multi-tenancy is treated as a fundamental, load-bearing requirement, not an afterthought: a request scoped to Tenant A must never be able to read, modify, or enumerate Tenant B's resources under any circumstance.

## Documents

- [`00-MULTI-TENANCY-ARCHITECTURE.md`](./00-MULTI-TENANCY-ARCHITECTURE.md) -- Multi-Tenancy Architecture
- [`01-TENANT-MODEL.md`](./01-TENANT-MODEL.md) -- Tenant Model
- [`02-APPLICATION-MODEL.md`](./02-APPLICATION-MODEL.md) -- Application Model
- [`03-PROJECT-MODEL.md`](./03-PROJECT-MODEL.md) -- Project Model
- [`04-DATA-ISOLATION.md`](./04-DATA-ISOLATION.md) -- Data Isolation
- [`05-STORAGE-ISOLATION.md`](./05-STORAGE-ISOLATION.md) -- Storage Isolation
- [`06-CDN-ISOLATION.md`](./06-CDN-ISOLATION.md) -- CDN Isolation
- [`07-QUOTA-ISOLATION.md`](./07-QUOTA-ISOLATION.md) -- Quota Isolation
- [`08-CROSS-TENANT-PROTECTION.md`](./08-CROSS-TENANT-PROTECTION.md) -- Cross-Tenant Protection
