// Module-graph rules (docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md, P0-11).
// ESLint sees one file at a time; these need the whole graph. Proof that
// each rule fires: tools/tests/depcruise-rules.test.ts.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Import cycles make initialization order an accident. ENGINEERING/10.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-service-to-service",
      severity: "error",
      comment: "Deployables share code through packages/, never by importing each other. ADR-017.",
      from: { path: "^services/([^/]+)/" },
      to: { path: "^services/([^/]+)/", pathNot: "^services/$1/" },
    },
    {
      name: "no-package-to-service",
      severity: "error",
      comment: "Libraries must not depend on a deployable. ENGINEERING/02.",
      from: { path: "^packages/" },
      to: { path: "^services/" },
    },
    {
      name: "no-app-to-internals",
      severity: "error",
      comment: "Front-end apps are clients of the public API only. ENGINEERING/02.",
      from: { path: "^apps/" },
      to: { path: "(^packages/db/|^services/|\\.repository\\.ts$|\\.service\\.ts$)" },
    },
    {
      name: "no-deep-package-import",
      severity: "error",
      comment:
        "Import a package by its name and public entry points; its src/ layout is private. ENGINEERING/02.",
      from: { path: "^(services|apps|sdks)/" },
      to: {
        path: "^packages/[^/]+/src/",
        // Only a relative path (../../packages/x/src/y) can reach a private
        // file: an import by package name is limited by the package's
        // `exports` map, and one that is not exported fails to resolve
        // (not-to-unresolvable below).
        dependencyTypes: ["local"],
      },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "An import that does not resolve is a missing dependency.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage|\\.turbo|node_modules)/" },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types"],
      extensions: [".ts", ".mts", ".js", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
