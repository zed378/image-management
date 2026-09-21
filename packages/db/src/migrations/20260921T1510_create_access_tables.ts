import { sql, type Kysely } from "kysely";

import { ulidPrimaryKey, updatedAtTrigger } from "./ddl";

// P1-01: who may do what -- narrower-than-tenant role grants, API keys and
// the projects a key covers. docs/DATABASE/12-13, ADR-022 points 1, 3, 4.
//
// Keys belong to an application (docs/MULTI-TENANCY/02). A key covers either
// every project of that application (all_projects) or the projects listed in
// api_key_projects, whose composite FKs force each project to be in the
// key's own application: a key for application A naming a project of
// application B is rejected by the database.

export const up = async (db: Kysely<unknown>): Promise<void> => {
  // Composite-FK targets on the P0-06 tables.
  await sql`alter table users add constraint users_id_tenant_uk unique (id, tenant_id)`.execute(db);
  await sql`
    alter table projects add constraint projects_id_application_tenant_uk
      unique (id, application_id, tenant_id)
  `.execute(db);

  // ==========================================
  // ROLE ASSIGNMENTS
  // ==========================================
  // users.role is the tenant-wide role; a row here grants a role on one
  // application or one project of it. Owner is tenant-wide only.
  await sql`
    create table role_assignments (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      user_id char(26) not null,
      role text not null check (role in ('admin', 'developer', 'viewer')),
      application_id char(26) not null,
      -- null: the grant covers the whole application.
      project_id char(26),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint role_assignments_user_fk foreign key (user_id, tenant_id)
        references users (id, tenant_id) on delete cascade,
      constraint role_assignments_application_fk foreign key (application_id, tenant_id)
        references applications (id, tenant_id) on delete cascade,
      constraint role_assignments_project_fk foreign key (project_id, application_id, tenant_id)
        references projects (id, application_id, tenant_id) on delete cascade,
      -- One grant per user per scope; a null project is the application scope.
      constraint role_assignments_scope_uk unique nulls not distinct
        (user_id, application_id, project_id)
    )
  `.execute(db);
  // Serves: load a user's grants on every request (cached, docs/ENGINEERING/08).
  await sql`create index role_assignments_user_idx on role_assignments (tenant_id, user_id)`.execute(
    db,
  );
  // Serve the application and project FKs' cascade.
  await sql`create index role_assignments_application_idx on role_assignments (application_id, tenant_id)`.execute(
    db,
  );
  await sql`create index role_assignments_project_idx on role_assignments (project_id) where project_id is not null`.execute(
    db,
  );
  await updatedAtTrigger("role_assignments").execute(db);

  // ==========================================
  // API KEYS
  // ==========================================
  await sql`
    create table api_keys (
      -- The public key id, carried in the plaintext key (P1-02) and safe to log.
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      application_id char(26) not null,
      name text not null check (length(name) between 1 and 200),
      environment text not null check (environment in ('live', 'test')),
      -- HMAC-SHA256(pepper, secret), hex (ADR-022 point 4). Never the secret.
      key_hash char(64) not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
      -- Permission names are validated against the P1-04 matrix in code.
      permissions text[] not null check (
        cardinality(permissions) between 1 and 64 and array_position(permissions, null) is null
      ),
      all_projects boolean not null default false,
      status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
      -- Set on the old key when it is rotated: valid until the overlap ends.
      expires_at timestamptz,
      revoked_at timestamptz,
      -- Written asynchronously, never on the request path (P1-02).
      last_used_at timestamptz,
      created_by_user_id char(26),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint api_keys_revoked_ck check ((status = 'revoked') = (revoked_at is not null)),
      constraint api_keys_application_fk foreign key (application_id, tenant_id)
        references applications (id, tenant_id) on delete restrict,
      constraint api_keys_creator_fk foreign key (created_by_user_id, tenant_id)
        references users (id, tenant_id) on delete restrict,
      constraint api_keys_id_application_tenant_uk unique (id, application_id, tenant_id)
    )
  `.execute(db);
  // Serves: list an application's keys, newest first; the application FK check.
  await sql`
    create index api_keys_application_idx on api_keys (tenant_id, application_id, created_at desc)
  `.execute(db);
  // Serves: the creator FK's restrict check.
  await sql`
    create index api_keys_creator_idx on api_keys (created_by_user_id)
      where created_by_user_id is not null
  `.execute(db);
  await updatedAtTrigger("api_keys").execute(db);

  await sql`
    create table api_key_projects (
      tenant_id char(26) not null,
      application_id char(26) not null,
      api_key_id char(26) not null,
      project_id char(26) not null,
      created_at timestamptz not null default now(),
      primary key (api_key_id, project_id),
      constraint api_key_projects_key_fk foreign key (api_key_id, application_id, tenant_id)
        references api_keys (id, application_id, tenant_id) on delete cascade,
      constraint api_key_projects_project_fk foreign key (project_id, application_id, tenant_id)
        references projects (id, application_id, tenant_id) on delete restrict
    )
  `.execute(db);
  // Serves: the project FK's restrict check.
  await sql`create index api_key_projects_project_idx on api_key_projects (project_id)`.execute(db);
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`drop table api_key_projects`.execute(db);
  await sql`drop table api_keys`.execute(db);
  await sql`drop table role_assignments`.execute(db);
  await sql`alter table projects drop constraint projects_id_application_tenant_uk`.execute(db);
  await sql`alter table users drop constraint users_id_tenant_uk`.execute(db);
};
