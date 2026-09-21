# 01 - Entity Relationship Diagram

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1 -- grows with each schema task) &nbsp;|&nbsp; Owner: TBD

## Purpose

A diagram of the tables that **exist** -- not the ones planned. Every
migration that adds a table updates this document in the same change.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

## Current schema (after `P0-06`)

```mermaid
erDiagram
    tenants ||--o{ users : "has"
    tenants ||--o{ applications : "owns"
    applications ||--o{ projects : "contains"

    tenants {
        char26 id PK "ULID"
        text name
        text slug UK
        text plan "free|pro|business|enterprise"
        text status "active|suspended"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }
    users {
        char26 id PK
        char26 tenant_id FK
        citext email UK "case-insensitive"
        text display_name
        text password_hash "null until set"
        text role "owner|admin|developer|viewer"
        text status "active|disabled"
        timestamptz last_login_at
    }
    applications {
        char26 id PK
        char26 tenant_id FK
        text name
        text slug "unique per tenant"
        text status "active|suspended"
    }
    projects {
        char26 id PK
        char26 tenant_id "composite FK with application_id"
        char26 application_id FK
        text name
        text slug "unique per application"
        jsonb settings
        text status "active|archived"
    }
```

## Constraints worth seeing

| Constraint | Table | Meaning |
|---|---|---|
| `applications_id_tenant_uk unique (id, tenant_id)` | applications | Target for composite FKs |
| `projects_application_fk (application_id, tenant_id) -> applications (id, tenant_id)` | projects | A project's tenant must equal its application's tenant |
| `projects_id_tenant_uk unique (id, tenant_id)` | projects | Target for composite FKs from every project-owned table (`P1-01`) |
| `users_email_key unique (email)` on `citext` | users | One account per email, case-insensitively |

## Acceptance Criteria

- [x] Reflects exactly the tables and columns the migrations create.

## Open Questions

- Extended by `P1-01` with the asset, derivative, taxonomy, key, usage,
  webhook, and audit tables.

## Related Documents

- `docs/DATABASE/00-DATA-MODEL.md`
- `packages/db/src/migrations/`
