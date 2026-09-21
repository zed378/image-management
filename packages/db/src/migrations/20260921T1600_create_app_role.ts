import { sql, type Kysely } from "kysely";

// P1-07: the privileges the running application has, separate from the
// role that owns the schema and runs migrations (docs/DEVOPS/04,
// docs/SECURITY/17).
//
//   image_delivery_app  NOLOGIN group role. The api and worker connect as a
//                       login role that is a member of it.
//
// It may read and write every table -- except that on audit_logs it may
// only INSERT and SELECT. Together with the audit_logs_guard trigger, a
// written audit entry cannot be changed or removed by the application, even
// by a bug or an injected statement: that needs the owner role, which only
// the migration and retention jobs hold.
//
// Roles are cluster-wide, so creation is idempotent and `down` revokes
// grants but never drops the role another database may use.

export const APP_ROLE = "image_delivery_app";

export const up = async (db: Kysely<unknown>): Promise<void> => {
  await sql`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = ${sql.lit(APP_ROLE)}) then
        create role ${sql.id(APP_ROLE)} nologin;
      end if;
    end
    $$
  `.execute(db);

  await sql`grant usage on schema public to ${sql.id(APP_ROLE)}`.execute(db);
  await sql`
    grant select, insert, update, delete on all tables in schema public to ${sql.id(APP_ROLE)}
  `.execute(db);
  await sql`grant usage, select on all sequences in schema public to ${sql.id(APP_ROLE)}`.execute(
    db,
  );
  // Tables created by later migrations (run by this same owner role) get
  // the same grants without each migration remembering to add them.
  await sql`
    alter default privileges in schema public
      grant select, insert, update, delete on tables to ${sql.id(APP_ROLE)}
  `.execute(db);

  // The append-only table: insert and read, nothing else.
  await sql`revoke update, delete, truncate on audit_logs from ${sql.id(APP_ROLE)}`.execute(db);
  // The migrator's bookkeeping is not the application's to touch.
  await sql`
    revoke insert, update, delete on kysely_migration, kysely_migration_lock from ${sql.id(APP_ROLE)}
  `.execute(db);
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`
    alter default privileges in schema public
      revoke select, insert, update, delete on tables from ${sql.id(APP_ROLE)}
  `.execute(db);
  await sql`revoke all on all tables in schema public from ${sql.id(APP_ROLE)}`.execute(db);
  await sql`revoke all on all sequences in schema public from ${sql.id(APP_ROLE)}`.execute(db);
  await sql`revoke usage on schema public from ${sql.id(APP_ROLE)}`.execute(db);
};
