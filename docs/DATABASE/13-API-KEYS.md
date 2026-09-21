# 13 - API Keys

> Category: **Database** (`docs/DATABASE/`) &nbsp;|&nbsp; Status: Final (v1) &nbsp;|&nbsp; Owner: TBD

## Purpose

Credentials for server-to-server access. A key belongs to one application,
covers some or all of that application's projects, carries an explicit
permission list, and is stored only as a keyed hash.

## Category Mandate

The relational data model underlying assets, tenancy, permissions, usage,
and audit.

---

<!-- schema:api_keys -->
Table `api_keys` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `character(26)` | no |  |
| `tenant_id` | `character(26)` | no |  |
| `application_id` | `character(26)` | no |  |
| `name` | `text` | no |  |
| `environment` | `text` | no |  |
| `key_hash` | `character(64)` | no |  |
| `permissions` | `text[]` | no |  |
| `all_projects` | `boolean` | no | `false` |
| `status` | `text` | no | `'active'::text` |
| `expires_at` | `timestamp with time zone` | yes |  |
| `revoked_at` | `timestamp with time zone` | yes |  |
| `last_used_at` | `timestamp with time zone` | yes |  |
| `created_by_user_id` | `character(26)` | yes |  |
| `created_at` | `timestamp with time zone` | no | `now()` |
| `updated_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `api_keys_environment_check`: `CHECK ((environment = ANY (ARRAY['live'::text, 'test'::text])))`
- `api_keys_id_check`: `CHECK ((id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'::text))`
- `api_keys_key_hash_check`: `CHECK ((key_hash ~ '^[0-9a-f]{64}$'::text))`
- `api_keys_name_check`: `CHECK (((length(name) >= 1) AND (length(name) <= 200)))`
- `api_keys_permissions_check`: `CHECK ((((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 64)) AND (array_position(permissions, NULL::text) IS NULL)))`
- `api_keys_revoked_ck`: `CHECK (((status = 'revoked'::text) = (revoked_at IS NOT NULL)))`
- `api_keys_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'revoked'::text])))`
- `api_keys_application_fk`: `FOREIGN KEY (application_id, tenant_id) REFERENCES applications(id, tenant_id) ON DELETE RESTRICT`
- `api_keys_creator_fk`: `FOREIGN KEY (created_by_user_id, tenant_id) REFERENCES users(id, tenant_id) ON DELETE RESTRICT`
- `api_keys_pkey`: `PRIMARY KEY (id)`
- `api_keys_id_application_tenant_uk`: `UNIQUE (id, application_id, tenant_id)`
- `api_keys_key_hash_key`: `UNIQUE (key_hash)`

Indexes:

- `api_keys_application_idx`: `(tenant_id, application_id, created_at DESC)`
- `api_keys_creator_idx`: `(created_by_user_id) WHERE (created_by_user_id IS NOT NULL)`
<!-- /schema:api_keys -->

<!-- schema:api_key_projects -->
Table `api_key_projects` (generated from the migrated schema):

| Column | Type | Null | Default |
|---|---|---|---|
| `tenant_id` | `character(26)` | no |  |
| `application_id` | `character(26)` | no |  |
| `api_key_id` | `character(26)` | no |  |
| `project_id` | `character(26)` | no |  |
| `created_at` | `timestamp with time zone` | no | `now()` |

Constraints:

- `api_key_projects_key_fk`: `FOREIGN KEY (api_key_id, application_id, tenant_id) REFERENCES api_keys(id, application_id, tenant_id) ON DELETE CASCADE`
- `api_key_projects_project_fk`: `FOREIGN KEY (project_id, application_id, tenant_id) REFERENCES projects(id, application_id, tenant_id) ON DELETE RESTRICT`
- `api_key_projects_pkey`: `PRIMARY KEY (api_key_id, project_id)`

Indexes:

- `api_key_projects_project_idx`: `(project_id)`
<!-- /schema:api_key_projects -->

## Columns that need explaining

| Column | Meaning |
|---|---|
| `id` | The public key id. It is carried in the plaintext key (format owned by `P1-02`), so authentication looks the row up by id and then compares hashes -- and it is safe to log. |
| `key_hash` | `HMAC-SHA256(pepper, secret)`, lower-case hex (ADR-022 point 4, `SEC-AUTH-01`). The secret itself is never stored and is returned exactly once, at creation (`SEC-AUTH-02`). Unique. |
| `environment` | `live` or `test`, visible in the key prefix so a test key in production is obvious. |
| `permissions` | 1-64 permission names from the `P1-04` matrix; validated by the service. |
| `all_projects` | `true`: every current and future project of the application. `false`: exactly the projects in `api_key_projects`. |
| `status` | `active`; `suspended` (temporary, by an operator, `P5-05`); `revoked` (permanent). `revoked_at` is set exactly when revoked (`api_keys_revoked_ck`). |
| `expires_at` | Set on the old key during rotation: it stays valid until the overlap window ends (`P1-02`). |
| `last_used_at` | Written asynchronously and coarsely, never on the request path. |

## Invariants

Enforced by the database:

- A key's application is in the key's tenant; a key's listed projects are
  in the key's **application** (`api_key_projects_project_fk` over
  `(project_id, application_id, tenant_id)`), so a key can never name
  another application's project.
- `revoked_at` iff `status = 'revoked'`.

Enforced by the service:

- `all_projects = true` has no `api_key_projects` rows.
- Revocation takes effect on the next request, cache included (`SEC-AUTH-05`).
- A suspended application's keys fail authentication (`docs/DATABASE/03`).
- Create, rotate, suspend and revoke are audited (`P1-07`).

## Acceptance Criteria

- [x] The column tables are generated from the migrated schema and checked
      on every CI run.
- [x] The cross-application project rule and the revoked-at rule are tested.

## Related Documents

- `docs/SECURITY/04-API-KEY-MANAGEMENT.md`, `docs/SECURITY/00` (`SEC-AUTH-*`)
- `docs/MULTI-TENANCY/02-APPLICATION-MODEL.md`
- `MEMORY/DECISIONS.md` (`ADR-022` points 3-4)
