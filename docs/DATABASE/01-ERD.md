# 01 - Entity Relationship Diagram

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1 -- grows with each schema task) &nbsp;|&nbsp; Owner: TBD

## Purpose

A diagram of the tables that **exist** -- not the ones planned. Every
migration that adds a table updates this document in the same change.
Columns are abridged to keys and the fields that explain a relationship; the
exact definitions are the generated blocks in each table's document
(`02`-`17`).

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

## Current schema (after `P1-01`)

### Tenancy and access

```mermaid
erDiagram
    tenants ||--o{ users : "has"
    tenants ||--o{ applications : "owns"
    tenants ||--o{ quota_overrides : "may have"
    tenants ||--o{ audit_logs : "records"
    applications ||--o{ projects : "contains"
    applications ||--o{ api_keys : "issues"
    applications ||--o{ webhooks : "registers"
    users ||--o{ role_assignments : "is granted"
    applications ||--o{ role_assignments : "scopes"
    projects ||--o{ role_assignments : "narrows"
    api_keys ||--o{ api_key_projects : "covers"
    projects ||--o{ api_key_projects : "is covered by"
    webhooks ||--o{ webhook_deliveries : "attempts"
    projects ||--o{ usage : "meters"

    tenants {
        char26 id PK
        text slug UK
        text plan "free|pro|business|enterprise"
    }
    users {
        char26 id PK
        char26 tenant_id FK
        citext email UK
        text role "owner|admin|developer|viewer (tenant-wide)"
    }
    applications {
        char26 id PK
        char26 tenant_id FK
    }
    projects {
        char26 id PK
        char26 tenant_id "composite FK"
        char26 application_id FK
    }
    role_assignments {
        char26 id PK
        char26 user_id FK
        text role "admin|developer|viewer"
        char26 application_id FK
        char26 project_id FK "null = whole application"
    }
    api_keys {
        char26 id PK "public key id"
        char26 application_id FK
        char64 key_hash UK "HMAC-SHA256"
        text_array permissions
        bool all_projects
        text status "active|suspended|revoked"
    }
    api_key_projects {
        char26 api_key_id PK
        char26 project_id PK "same application"
    }
    webhooks {
        char26 id PK
        char26 application_id FK
        text_array events
        bytea secret_ciphertext
    }
    webhook_deliveries {
        char26 id PK
        char26 webhook_id FK
        char26 event_id
        smallint attempt
        text outcome
    }
    usage {
        char26 project_id PK
        text metric PK
        date day PK
        bigint value
    }
    quotas {
        text plan PK "global"
        text metric PK
        bigint limit_value "null = unlimited"
    }
    quota_overrides {
        char26 tenant_id PK
        text metric PK
    }
    audit_logs {
        char26 id PK
        char26 tenant_id FK
        text actor_type
        text action "append-only"
        text target_type
    }
```

### Assets

```mermaid
erDiagram
    projects ||--o{ folders : "contains"
    projects ||--o{ assets : "contains"
    projects ||--o{ tags : "defines"
    projects ||--o{ collections : "defines"
    folders ||--o{ folders : "parent of"
    folders ||--o{ assets : "files"
    assets ||--o{ asset_versions : "has"
    assets |o--o| asset_versions : "current version"
    assets ||--o{ asset_metadata : "describes"
    asset_versions ||--o{ image_derivatives : "renders"
    assets ||--o{ asset_tags : "tagged"
    tags ||--o{ asset_tags : "labels"
    collections ||--o{ collection_assets : "orders"
    assets ||--o{ collection_assets : "member of"

    folders {
        char26 id PK
        char26 parent_id FK "same project"
        citext path UK "live folders"
        smallint depth "1-16"
    }
    assets {
        char26 id PK
        char26 folder_id FK "same project"
        char26 current_version_id FK "own version only"
        text status "pending|processing|ready|failed"
        text visibility "private|public|unlisted|signed|expiring"
    }
    asset_versions {
        char26 id PK
        char26 asset_id FK
        int version_number UK "per asset"
        text storage_key UK
        char64 checksum_sha256
    }
    asset_metadata {
        char26 id PK
        char26 asset_id FK
        text source "user|extracted"
        text key
    }
    image_derivatives {
        char26 id PK
        char26 asset_version_id FK
        text params_hash "UK with version"
        text format
        text storage_key UK
    }
    tags {
        char26 id PK
        citext name UK "live, per project"
    }
    asset_tags {
        char26 asset_id PK
        char26 tag_id PK
    }
    collections {
        char26 id PK
        citext name UK "live, per project"
    }
    collection_assets {
        char26 collection_id PK
        char26 asset_id PK "RESTRICT"
        int position
    }
```

Every table also carries `tenant_id` (and, if project-owned, `project_id`);
they are omitted above for readability and are part of every composite FK.

## Constraints worth seeing

| Constraint | Meaning |
|---|---|
| `*_id_tenant_uk unique (id, tenant_id)` | Target for composite FKs from tenant-owned children |
| `*_id_project_tenant_uk unique (id, project_id, tenant_id)` | Target for FKs between project-owned rows: same project enforced |
| `projects_id_application_tenant_uk` | Lets `api_key_projects`, `role_assignments` and `usage` prove a project is in a given application |
| `assets_current_version_fk (current_version_id, id, ...) -> asset_versions (id, asset_id, ...)` | The pointer names this asset's own version |
| `image_derivatives_identity_uk (tenant_id, project_id, asset_version_id, params_hash)` | One derivative per version and transformation (ADR-004) |
| `collection_assets_asset_fk ... on delete restrict` | An asset in a collection cannot be purged |
| `audit_logs_guard` trigger | UPDATE never; DELETE/TRUNCATE only in the retention purge |

## Acceptance Criteria

- [x] Reflects exactly the tables the migrations create (the migration
      lint's table list and the generated blocks are the check).

## Related Documents

- `docs/DATABASE/00-DATA-MODEL.md`, `02`-`18`
- `packages/db/src/migrations/`
- `MEMORY/DECISIONS.md` (`ADR-005`, `ADR-022`)
