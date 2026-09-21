import { defineConfig } from "vitest/config";

// Two projects, per docs/ENGINEERING/09-TESTING-CONVENTIONS.md:
//   unit         -- *.test.ts beside the source, no external dependencies
//   integration  -- *.int.test.ts, against real Postgres/Redis/MinIO
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "services/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.int.test.ts",
        "**/index.ts",
        // Process entry points and their env loading: exercised by
        // services/*/tests/boot.test.ts in a child process, which v8
        // coverage in this process cannot see.
        "services/*/src/{server,migrate,config}.ts",
        // Test infrastructure, not product code.
        "packages/test-utils/**",
      ],
      // docs/ENGINEERING/09 "Coverage". Enforced over unit + integration
      // together (`pnpm test:coverage`, CI's integration job). A glob's
      // numbers apply to the files it matches as a group; the more specific
      // entries are the 100%-branch scopes.
      thresholds: {
        // Every package file except the network storage adapters (below).
        "packages/**/!(adapters)/*.ts": { lines: 90, branches: 85 },
        // INTERIM FLOOR, not the target: the storage adapters' remaining
        // uncovered branches are provider-error and SDK-default paths that
        // need fault injection against each backend. Ratchet only upward;
        // raised to the packages/** numbers by P2-11 (TASKS/PHASE-2).
        "packages/storage-adapter/src/adapters/*.ts": { lines: 90, branches: 60 },
        "services/**": { lines: 80, branches: 75 },
        "packages/errors/src/**": { lines: 100, branches: 100 },
        "packages/transform-params/src/**": { branches: 100 },
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "{packages,services,sdks}/*/src/**/*.test.ts",
            "{packages,services,sdks}/*/tests/**/*.test.ts",
            "tools/tests/*.test.ts",
          ],
          exclude: ["**/*.int.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: [
            "{packages,services}/*/tests/**/*.int.test.ts",
            "{packages,services}/*/src/**/*.int.test.ts",
          ],
          environment: "node",
          globalSetup: ["./packages/test-utils/src/global-setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
