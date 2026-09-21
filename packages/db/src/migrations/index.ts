import * as m20260921T0900 from "./20260921T0900_create_tenancy_chain";
import * as m20260921T1500 from "./20260921T1500_create_asset_tables";
import * as m20260921T1510 from "./20260921T1510_create_access_tables";
import * as m20260921T1520 from "./20260921T1520_create_platform_tables";

import type { Migration } from "kysely/migration";

// Static registry: every migration is imported here, so migrations are part
// of the bundled deployable and run without a TypeScript toolchain in the
// production image. Names sort lexicographically by timestamp; Kysely applies
// them in that order and records each in kysely_migration.
//
// A migration, once it has run anywhere but a local machine, is never edited
// again -- fix it with a new migration (docs/ENGINEERING/01, section 21).
export const MIGRATIONS: Readonly<Record<string, Migration>> = {
  "20260921T0900_create_tenancy_chain": m20260921T0900,
  "20260921T1500_create_asset_tables": m20260921T1500,
  "20260921T1510_create_access_tables": m20260921T1510,
  "20260921T1520_create_platform_tables": m20260921T1520,
};
