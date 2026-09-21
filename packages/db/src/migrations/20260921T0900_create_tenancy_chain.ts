import { sql, type Kysely } from "kysely";

import { timestampColumns, ulidPrimaryKey, updatedAtTrigger } from "./ddl";

// P0-06: the tenancy chain  tenants -> applications -> projects, plus users.
// docs/DATABASE/02-USERS.md, 03-APPLICATIONS.md, 04-PROJECTS.md,
// docs/MULTI-TENANCY/01-03.
//
// The load-bearing idea: composite foreign keys. A project references
// (application_id, tenant_id), not just application_id, so the database
// itself rejects a project whose tenant_id disagrees with its application's.
// Every tenant-owned table added later follows the same pattern, which makes
// a cross-tenant parent/child mismatch unrepresentable rather than merely
// unlikely (ADR-005 at the schema layer).

export const up = async (db: Kysely<unknown>): Promise<void> => {
  await sql`create extension if not exists citext`.execute(db);

  await sql`
    create function set_updated_at() returns trigger language plpgsql as $$
    begin
      new.updated_at = now();
      return new;
    end
    $$
  `.execute(db);

  await sql`
    create table tenants (
      ${ulidPrimaryKey()},
      name text not null check (length(name) between 1 and 200),
      slug text not null unique
        check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
      plan text not null default 'free'
        check (plan in ('free', 'pro', 'business', 'enterprise')),
      status text not null default 'active'
        check (status in ('active', 'suspended')),
      ${timestampColumns()}
    )
  `.execute(db);
  await updatedAtTrigger("tenants").execute(db);

  await sql`
    create table users (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null references tenants (id) on delete restrict,
      email citext not null unique check (length(email) between 3 and 320),
      display_name text not null check (length(display_name) between 1 and 200),
      password_hash text,
      role text not null check (role in ('owner', 'admin', 'developer', 'viewer')),
      status text not null default 'active' check (status in ('active', 'disabled')),
      last_login_at timestamptz,
      ${timestampColumns()}
    )
  `.execute(db);
  await sql`create index users_tenant_id_idx on users (tenant_id)`.execute(db);
  await updatedAtTrigger("users").execute(db);

  await sql`
    create table applications (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null references tenants (id) on delete restrict,
      name text not null check (length(name) between 1 and 200),
      slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
      status text not null default 'active' check (status in ('active', 'suspended')),
      ${timestampColumns()},
      constraint applications_tenant_slug_uk unique (tenant_id, slug),
      -- Target for composite foreign keys from child tables.
      constraint applications_id_tenant_uk unique (id, tenant_id)
    )
  `.execute(db);
  await updatedAtTrigger("applications").execute(db);

  await sql`
    create table projects (
      ${ulidPrimaryKey()},
      tenant_id char(26) not null,
      application_id char(26) not null,
      name text not null check (length(name) between 1 and 200),
      slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
      settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
      status text not null default 'active' check (status in ('active', 'archived')),
      ${timestampColumns()},
      constraint projects_application_fk foreign key (application_id, tenant_id)
        references applications (id, tenant_id) on delete restrict,
      constraint projects_application_slug_uk unique (application_id, slug),
      constraint projects_id_tenant_uk unique (id, tenant_id)
    )
  `.execute(db);
  // Serves "every project of a tenant" (dashboard, admin, usage rollups).
  await sql`create index projects_tenant_id_idx on projects (tenant_id)`.execute(db);
  await updatedAtTrigger("projects").execute(db);
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`drop table projects`.execute(db);
  await sql`drop table applications`.execute(db);
  await sql`drop table users`.execute(db);
  await sql`drop table tenants`.execute(db);
  await sql`drop function set_updated_at()`.execute(db);
  // citext is left installed: extensions are database-wide and a later
  // migration or another schema may depend on it.
};
