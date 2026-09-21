// Guard for ADR-018's build model: services inline workspace packages but
// leave third-party packages external. A bare import in the bundle that is
// not a *direct* dependency of the service resolves fine in a hoisted dev
// install and then fails at runtime in the strict pnpm deploy the Docker image
// uses ("Cannot find package 'pg'"). This script makes that a build failure.
//
//   node scripts/check-bundle-deps.mjs            checks every service
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

// Static `import ... from "x"`, `export ... from "x"`, and dynamic `import("x")`.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"'./][^"']*)["']/g;

const packageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

let failed = false;
for (const service of readdirSync(path.join(root, "services"))) {
  const dir = path.join(root, "services", service);
  let files;
  try {
    files = readdirSync(path.join(dir, "dist")).filter((f) => f.endsWith(".js"));
  } catch {
    continue; // not built
  }
  const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const declared = new Set(Object.keys(manifest.dependencies ?? {}));
  const missing = new Set();
  for (const file of files) {
    const source = readFileSync(path.join(dir, "dist", file), "utf8");
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      if (builtins.has(specifier) || specifier.startsWith("node:")) continue;
      const name = packageName(specifier);
      if (!declared.has(name)) missing.add(name);
    }
  }
  if (missing.size > 0) {
    failed = true;
    console.error(
      `services/${service}: the bundle imports packages that are not direct dependencies:\n` +
        [...missing].sort().map((m) => `  - ${m}`).join("\n") +
        `\n  Add them to services/${service}/package.json "dependencies".`,
    );
  } else {
    console.log(`services/${service}: every external import is a declared dependency`);
  }
}
process.exit(failed ? 1 : 0);
