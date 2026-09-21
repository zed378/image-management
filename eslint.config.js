// ESLint flat config (docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md, P0-11).
//
// Three layers: the type-checked correctness rules, the architectural rules
// that keep ADR-001/004/005 true after the session that wrote them ends, and
// narrow relaxations for tests and build scripts. Every architectural rule's
// message names the document it enforces, so the rule teaches rather than
// just blocks. Proof that each one fires: tools/lint-fixtures/.
import { defineConfig } from "eslint/config";
import { importX } from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

const PROVIDER_SDKS = [
  "@aws-sdk/*",
  "@azure/storage-blob",
  "@google-cloud/storage",
  "minio",
  "ssh2-sftp-client",
  "webdav",
];

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.data/**",
      // Other tools' worktrees nested in the checkout (not this repository's code).
      ".kilo/**",
      ".claude/**",
      // Deliberate violations; tools/tests/ asserts the rules fire on them.
      "tools/tests/fixtures/**",
    ],
  },

  // ==========================================
  // CORRECTNESS (type-checked)
  // ==========================================
  {
    files: ["**/*.ts", "**/*.mts"],
    extends: [tseslint.configs.strictTypeChecked],
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.ts",
            "scripts/*.ts",
            "services/*/tsup.config.ts",
            "tools/tests/*.ts",
          ],
          defaultProject: "tsconfig.base.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Same convention as tsc's noUnusedParameters: a leading underscore
      // marks a parameter kept for its type or its documentation value.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      // Template literals with numbers are the normal way to build a message.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // Off deliberately: an `async` function implementing a Promise-returning
      // interface (a storage adapter method, a readiness check, a test stub)
      // turns a synchronous throw into a rejection, which is the contract.
      "@typescript-eslint/require-await": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use an `as const` object and a union type, not `enum`. See ENGINEERING/04.",
        },
      ],
      "import-x/no-default-export": "error",
      // Cycles are dependency-cruiser's `no-circular` (whole graph, one pass);
      // import-x/no-cycle re-walks the graph per file and doubled lint time.
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          pathGroups: [{ pattern: "@image-delivery/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      eqeqeq: ["error", "always"],
      "no-param-reassign": "error",
      "prefer-const": "error",
    },
    settings: {
      "import-x/internal-regex": "^@image-delivery/",
    },
  },

  // ==========================================
  // ARCHITECTURE
  // ==========================================
  // One `no-restricted-imports` per file set: ESLint replaces, not merges, a
  // rule's options when two blocks match the same file, so each block below
  // restates every restriction that applies to its files.
  {
    files: ["**/*.ts"],
    ignores: ["packages/storage-adapter/**", "packages/transform-params/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: PROVIDER_SDKS,
              message: "Provider SDKs live only in packages/storage-adapter. ADR-001.",
            },
          ],
          paths: [
            {
              name: "node:crypto",
              importNames: ["createHash"],
              message:
                "Hashing transformation params happens only in packages/transform-params. ADR-004.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/storage-adapter/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "node:crypto",
              importNames: ["createHash"],
              message:
                "Hashing transformation params happens only in packages/transform-params. ADR-004.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["services/*/src/**/*.controller.ts", "services/*/src/**/*.routes.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*.repository", "**/*.repository.js"],
              message: "Controllers call services, not repositories. See ENGINEERING/01 section 6.",
            },
            {
              group: ["@image-delivery/db", "@image-delivery/db/*"],
              message: "Controllers must not touch the query layer. ADR-005.",
            },
            {
              group: PROVIDER_SDKS,
              message: "Provider SDKs live only in packages/storage-adapter. ADR-001.",
            },
          ],
          paths: [
            {
              name: "node:crypto",
              importNames: ["createHash"],
              message:
                "Hashing transformation params happens only in packages/transform-params. ADR-004.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["services/*/src/**/*.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "fastify",
              message:
                "Services must not know about HTTP; workers reuse them. See ENGINEERING/01 section 8.",
            },
            {
              name: "@image-delivery/db",
              importNames: ["unsafeUnscoped"],
              message: "unsafeUnscoped is for admin and maintenance contexts only. ADR-005.",
            },
            {
              name: "node:crypto",
              importNames: ["createHash"],
              message:
                "Hashing transformation params happens only in packages/transform-params. ADR-004.",
            },
          ],
          patterns: [
            {
              group: ["**/http/*", "**/middlewares/*"],
              message: "A service that needs HTTP plumbing is doing controller work.",
            },
            {
              group: PROVIDER_SDKS,
              message: "Provider SDKs live only in packages/storage-adapter. ADR-001.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["services/*/src/modules/**/*.repository.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@image-delivery/db",
              importNames: ["unsafeUnscoped"],
              message: "unsafeUnscoped is for admin and maintenance contexts only. ADR-005.",
            },
            {
              name: "node:crypto",
              importNames: ["createHash"],
              message:
                "Hashing transformation params happens only in packages/transform-params. ADR-004.",
            },
          ],
          patterns: [
            {
              group: PROVIDER_SDKS,
              message: "Provider SDKs live only in packages/storage-adapter. ADR-001.",
            },
          ],
        },
      ],
    },
  },
  // Structured logging only.
  {
    files: ["services/**/*.ts", "packages/**/*.ts"],
    ignores: ["**/*.test.ts", "**/tests/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use an `as const` object and a union type, not `enum`. See ENGINEERING/04.",
        },
        {
          selector: "MemberExpression[object.name='console']",
          message: "Use the logger from @image-delivery/logger. See ENGINEERING/12.",
        },
      ],
    },
  },

  // ==========================================
  // RELAXATIONS
  // ==========================================
  {
    files: ["**/*.test.ts", "**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
    },
  },
  // Tool configs whose loader requires a default export.
  {
    files: ["*.config.ts", "services/*/tsup.config.ts", "packages/test-utils/src/global-setup.ts"],
    rules: { "import-x/no-default-export": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
