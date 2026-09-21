import { defineConfig } from "vitest/config";

// Two projects, per docs/ENGINEERING/09-TESTING-CONVENTIONS.md:
//   unit         -- *.test.ts beside the source, no external dependencies
//   integration  -- *.int.test.ts, against real Postgres/Redis/MinIO
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "services/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.int.test.ts", "**/index.ts", "**/server.ts"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["{packages,services,sdks}/*/src/**/*.test.ts", "{packages,services,sdks}/*/tests/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["{packages,services}/*/tests/**/*.int.test.ts", "{packages,services}/*/src/**/*.int.test.ts"],
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
