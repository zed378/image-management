// `pnpm deps:check` (P0-11): dependency-cruiser over every workspace root
// that exists. apps/ and sdks/ are created by later phases; listing them
// unconditionally would fail today, and leaving them out would silently skip
// them tomorrow.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const roots = ["packages", "services", "apps", "sdks"].filter((dir) => existsSync(dir));
const result = spawnSync(
  "pnpm",
  ["exec", "depcruise", ...roots, "--config", ".dependency-cruiser.cjs", ...process.argv.slice(2)],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
