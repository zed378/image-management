import { defineConfig } from "tsup";

// Workspace packages export TypeScript source, so they are inlined into the
// bundle (ADR-018). Third-party packages from node_modules are NOT bundled:
// several ship native binaries (sharp, ssh2) that cannot be bundled, and the
// Docker image installs them with `pnpm deploy --prod`.
export default defineConfig({
  entry: ["src/server.ts", "src/migrate.ts", "src/provision.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  skipNodeModulesBundle: true,
  noExternal: [/^@image-delivery\//],
});
