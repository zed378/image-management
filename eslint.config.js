// ESLint flat config. P0-03 establishes the baseline so `pnpm lint` runs in
// CI; P0-11 adds the architectural and correctness rules from
// docs/ENGINEERING/10-TOOLING-LINT-FORMAT.md.
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/.turbo/**"],
  },
  ...tseslint.configs.recommended,
);
