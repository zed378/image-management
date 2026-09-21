import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Spawns the real entry point, so "every service boots via packages/config"
// (P0-04 Definition of Done) is verified against the process, not a unit.

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const tsxLoader = import.meta.resolve("tsx/esm");

// Storage defaults to local disk (ADR-021), so only these are required
// outside production.
const REQUIRED = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
} as const;

// --check-config validates and exits, so a valid configuration does not leave
// a server listening.
const boot = (service: "api" | "worker", env: Record<string, string>) =>
  spawnSync(
    process.execPath,
    [
      "--import",
      tsxLoader,
      path.join(repoRoot, "services", service, "src", "server.ts"),
      "--check-config",
    ],
    {
      // A throwaway cwd so a developer's own .env can never satisfy the test.
      cwd: mkdtempSync(path.join(tmpdir(), "boot-test-")),
      env: { PATH: process.env["PATH"] ?? "", SYSTEMROOT: process.env["SYSTEMROOT"] ?? "", ...env },
      encoding: "utf8",
      timeout: 60_000,
    },
  );

// Spawning a TypeScript entry point is slow on Windows; allow for it.
describe.each(["api", "worker"] as const)("%s service boot", { timeout: 60_000 }, (service) => {
  it("starts when every required variable is present", () => {
    const result = boot(service, REQUIRED);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("configuration valid");
  });

  it.each(Object.keys(REQUIRED))("refuses to start without %s, naming it", (variable) => {
    const env: Record<string, string> = { ...REQUIRED };
    Reflect.deleteProperty(env, variable);

    const result = boot(service, env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(variable);
  });

  it("refuses to start in production on local storage without an explicit root", () => {
    const result = boot(service, { ...REQUIRED, NODE_ENV: "production" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("STORAGE_LOCAL_ROOT");
  });
});
