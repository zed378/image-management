import { defineConfig } from "tsup";

// Workspace packages export TypeScript source; bundling the service
// inlines them so the deployable is one self-contained file.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  noExternal: [/^@image-delivery\//],
});
