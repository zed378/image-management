import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  effectivePermissions,
  isPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from "./permissions";

// P1-04 DoD: docs/SECURITY/08 is Final with the complete role x action
// matrix, "matching the test table exactly". The test table IS the
// document: it is parsed here and compared with the code in every cell.

const DOC = path.resolve(import.meta.dirname, "../../../docs/SECURITY/08-RBAC.md");

const documentedMatrix = (): Map<string, Record<Role, boolean>> => {
  const rows = readFileSync(DOC, "utf8")
    .split("\n")
    .filter((line) => /^\| `[a-z-]+(:[a-z-]+){1,2}` \|/.test(line));
  return new Map(
    rows.map((line) => {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .slice(1, -1);
      const [permission, ...marks] = cells;
      return [
        (permission ?? "").replaceAll("`", ""),
        Object.fromEntries(ROLES.map((role, i) => [role, marks[i] === "yes"])) as Record<
          Role,
          boolean
        >,
      ];
    }),
  );
};

describe("the role x permission matrix", () => {
  const documented = documentedMatrix();

  it("documents every permission exactly once, and nothing else", () => {
    expect([...documented.keys()].sort()).toEqual([...PERMISSIONS].sort());
  });

  const cells = ROLES.flatMap((role) => PERMISSIONS.map((p) => [role, p] as const));

  it.each(cells)("%s / %s matches docs/SECURITY/08", (role, permission) => {
    expect(ROLE_PERMISSIONS[role].has(permission)).toBe(documented.get(permission)?.[role]);
  });

  it("nests the roles: each holds everything the one below it holds", () => {
    const [owner, admin, developer, viewer] = ROLES.map((r) => ROLE_PERMISSIONS[r]);
    for (const [upper, lower] of [
      [owner, admin],
      [admin, developer],
      [developer, viewer],
    ] as const) {
      for (const p of lower ?? []) expect(upper?.has(p), p).toBe(true);
    }
  });

  it("reserves credentials, members, tenant settings and purge for owner (SEC-AZ-03)", () => {
    const ownerOnly: Permission[] = [
      "api-key:create",
      "api-key:update",
      "api-key:delete",
      "member:update",
      "tenant:update",
      "asset:tenant:purge",
    ];
    for (const role of ROLES.filter((r) => r !== "owner")) {
      for (const p of ownerOnly) expect(ROLE_PERMISSIONS[role].has(p), `${role} ${p}`).toBe(false);
    }
  });

  it("recognizes only vocabulary permissions", () => {
    expect(isPermission("asset:read")).toBe(true);
    expect(isPermission("asset:everything")).toBe(false);
    expect(isPermission("")).toBe(false);
  });
});

describe("effective permissions across scopes", () => {
  const A = "APP_A";
  const B = "APP_B";
  const P = "PROJECT_P";
  const Q = "PROJECT_Q";
  const viewer = ROLE_PERMISSIONS.viewer;

  it("gives a tenant-wide role everywhere", () => {
    for (const scope of [
      { applicationId: null, projectId: null },
      { applicationId: A, projectId: null },
      { applicationId: A, projectId: P },
    ]) {
      expect(effectivePermissions("developer", [], scope)).toEqual(ROLE_PERMISSIONS.developer);
    }
  });

  it("applies an application grant to the application and all its projects", () => {
    const grants = [{ role: "admin" as const, applicationId: A, projectId: null }];

    expect(effectivePermissions("viewer", grants, { applicationId: A, projectId: null })).toEqual(
      ROLE_PERMISSIONS.admin,
    );
    expect(effectivePermissions("viewer", grants, { applicationId: A, projectId: P })).toEqual(
      ROLE_PERMISSIONS.admin,
    );
    expect(effectivePermissions("viewer", grants, { applicationId: B, projectId: null })).toEqual(
      viewer,
    );
    expect(
      effectivePermissions("viewer", grants, { applicationId: null, projectId: null }),
    ).toEqual(viewer);
  });

  it("applies a project grant to that project only", () => {
    const grants = [{ role: "developer" as const, applicationId: A, projectId: P }];

    expect(effectivePermissions("viewer", grants, { applicationId: A, projectId: P })).toEqual(
      ROLE_PERMISSIONS.developer,
    );
    expect(effectivePermissions("viewer", grants, { applicationId: A, projectId: Q })).toEqual(
      viewer,
    );
    expect(effectivePermissions("viewer", grants, { applicationId: A, projectId: null })).toEqual(
      viewer,
    );
    // Same project id under another application does not match.
    expect(effectivePermissions("viewer", grants, { applicationId: B, projectId: P })).toEqual(
      viewer,
    );
  });

  it("only adds: a lower grant never reduces a higher tenant-wide role", () => {
    const grants = [{ role: "viewer" as const, applicationId: A, projectId: null }];

    expect(effectivePermissions("admin", grants, { applicationId: A, projectId: P })).toEqual(
      ROLE_PERMISSIONS.admin,
    );
  });
});
