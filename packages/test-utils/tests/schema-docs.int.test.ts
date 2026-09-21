import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../src/database";
import { refreshSchemaBlocks } from "../src/schema-doc";

// docs/DATABASE/*.md must match the migrated schema exactly (P1-01 DoD).
// Each document embeds generated `<!-- schema:<table> -->` blocks; this test
// regenerates them from the live catalog and fails on any difference.
//
// After a migration changes a table, refresh the documents with:
//   UPDATE_SCHEMA_DOCS=1 pnpm vitest run --project integration schema-docs
// then write the prose that explains the change.

const DOCS = path.resolve(import.meta.dirname, "../../../docs/DATABASE");
const UPDATE = process.env["UPDATE_SCHEMA_DOCS"] === "1";

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
});
afterAll(async () => {
  await t.destroy();
});

const documents = readdirSync(DOCS)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => readFileSync(path.join(DOCS, f), "utf8").includes("<!-- schema:"));

describe("docs/DATABASE matches the migrated schema", () => {
  it("has documents with generated schema blocks", () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it.each(documents)("%s", async (file) => {
    const current = readFileSync(path.join(DOCS, file), "utf8");
    const fresh = await refreshSchemaBlocks(t.db, current);

    // Guard against a marker the renderer did not recognize (it would be left
    // as it was, and the comparison would pass without checking anything).
    const opened = fresh.match(/<!-- schema:[a-z_]+ -->/g) ?? [];
    const filled = fresh.match(/<!-- schema:[a-z_]+ -->\nTable `/g) ?? [];
    expect(filled.length).toBe(opened.length);

    if (UPDATE && fresh !== current) writeFileSync(path.join(DOCS, file), fresh);
    else expect(fresh).toBe(current);
  });
});
