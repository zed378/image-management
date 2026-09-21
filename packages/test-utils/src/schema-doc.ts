import { sql } from "kysely";

import type { Db } from "@image-delivery/db";

// Renders a table's definition, read from the live catalog, as Markdown.
// docs/DATABASE/*.md embed the output between markers
//
//   <!-- schema:assets -->  ...generated...  <!-- /schema:assets -->
//
// and tests/schema-docs.int.test.ts fails when a document no longer matches
// the migrated schema. "The document matches the schema exactly" (P1-01 DoD)
// is therefore checked on every CI run, not asserted once by a reviewer.
// Regenerate with UPDATE_SCHEMA_DOCS=1 (see that test).

type ColumnRow = { name: string; type: string; nullable: boolean; default: string | null };
type DefRow = { name: string; def: string };

const escapeCell = (value: string): string => value.replaceAll("|", "\\|");

export const renderTable = async (db: Db, table: string): Promise<string> => {
  const columns = (
    await sql<ColumnRow>`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
        not a.attnotnull as nullable, pg_get_expr(d.adbin, d.adrelid) as default
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = ${table}::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attnum
    `.execute(db)
  ).rows;

  const constraints = (
    await sql<DefRow>`
      select conname as name, pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = ${table}::regclass
      order by contype, conname
    `.execute(db)
  ).rows;

  // Indexes that do not merely back a constraint listed above.
  const indexes = (
    await sql<DefRow>`
      select i.relname as name, pg_get_indexdef(i.oid) as def
      from pg_index x join pg_class i on i.oid = x.indexrelid
      where x.indrelid = ${table}::regclass
        and not exists (select 1 from pg_constraint c where c.conindid = i.oid)
      order by i.relname
    `.execute(db)
  ).rows;

  const lines = [
    `Table \`${table}\` (generated from the migrated schema):`,
    "",
    "| Column | Type | Null | Default |",
    "|---|---|---|---|",
    ...columns.map(
      (c) =>
        `| \`${c.name}\` | \`${escapeCell(c.type)}\` | ${c.nullable ? "yes" : "no"} | ${
          c.default === null ? "" : `\`${escapeCell(c.default)}\``
        } |`,
    ),
    "",
    "Constraints:",
    "",
    ...constraints.map((c) => `- \`${c.name}\`: \`${c.def}\``),
  ];
  if (indexes.length > 0) {
    lines.push(
      "",
      "Indexes:",
      "",
      ...indexes.map(
        (i) =>
          `- \`${i.name}\`: \`${i.def.replace(/^CREATE (UNIQUE )?INDEX \S+ ON public\.\S+ USING btree /, (_m, u: string | undefined) => (u ? "unique " : ""))}\``,
      ),
    );
  }
  return lines.join("\n");
};

// The body may be empty: a freshly added marker pair has none.
const MARKER = /<!-- schema:([a-z_]+) -->\n(?:[\s\S]*?\n)?<!-- \/schema:\1 -->/g;

/** Replace every schema marker block in `markdown` with the current rendering. */
export const refreshSchemaBlocks = async (db: Db, markdown: string): Promise<string> => {
  const tables = [...markdown.matchAll(MARKER)].map((m) => m[1] ?? "");
  let out = markdown;
  for (const table of tables) {
    const rendered = await renderTable(db, table);
    out = out.replace(
      new RegExp(`<!-- schema:${table} -->\\n(?:[\\s\\S]*?\\n)?<!-- /schema:${table} -->`),
      () => `<!-- schema:${table} -->\n${rendered}\n<!-- /schema:${table} -->`,
    );
  }
  return out;
};
