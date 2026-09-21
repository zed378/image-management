import path from "node:path";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it, vi } from "vitest";

// P0-11 DoD: every architectural lint rule is proven to fire, not just
// present. Each case lints a violating snippet *as if* it lived at a real
// path, through the repository's own eslint.config.js, and asserts the
// rule's message names the document it enforces. Type-aware rules are
// switched off here (the snippets are not in any tsconfig); the
// architectural rules are all syntactic.

const ROOT = path.resolve(import.meta.dirname, "../..");

// A cold first lint loads the parser and plugins.
vi.setConfig({ testTimeout: 30_000 });

const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: [{ files: ["**/*.ts"], ...tseslint.configs.disableTypeChecked }],
});

const messagesFor = async (filePath: string, code: string) => {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  return (result?.messages ?? [])
    .filter(
      (m) =>
        m.ruleId === "no-restricted-imports" ||
        m.ruleId === "no-restricted-syntax" ||
        m.ruleId === "import-x/no-default-export",
    )
    .map((m) => `${m.ruleId ?? ""}: ${m.message}`);
};

describe("architectural lint rules fire", () => {
  it.each([
    [
      "a controller importing a repository",
      "services/api/src/modules/folder/folder.controller.ts",
      'import { findById } from "./folder.repository";\nexport const x = findById;\n',
      "Controllers call services, not repositories",
    ],
    [
      "a route file importing the query layer",
      "services/api/src/modules/folder/folder.routes.ts",
      'import { createDb } from "@image-delivery/db";\nexport const x = createDb;\n',
      "ADR-005",
    ],
    [
      "a service importing the HTTP framework",
      "services/api/src/modules/folder/folder.service.ts",
      'import Fastify from "fastify";\nexport const x = Fastify;\n',
      "Services must not know about HTTP",
    ],
    [
      "a service importing HTTP plumbing",
      "services/api/src/modules/folder/folder.service.ts",
      'import { sendError } from "../../http/respond";\nexport const x = sendError;\n',
      "doing controller work",
    ],
    [
      "a service using unsafeUnscoped",
      "services/api/src/modules/folder/folder.service.ts",
      'import { unsafeUnscoped } from "@image-delivery/db";\nexport const x = unsafeUnscoped;\n',
      "unsafeUnscoped is for admin and maintenance contexts only",
    ],
    [
      "a repository using unsafeUnscoped",
      "services/api/src/modules/folder/folder.repository.ts",
      'import { unsafeUnscoped } from "@image-delivery/db";\nexport const x = unsafeUnscoped;\n',
      "unsafeUnscoped is for admin and maintenance contexts only",
    ],
    [
      "a provider SDK outside storage-adapter",
      "services/worker/src/upload.ts",
      'import { S3Client } from "@aws-sdk/client-s3";\nexport const x = S3Client;\n',
      "ADR-001",
    ],
    [
      "a provider SDK in a service file",
      "services/api/src/modules/asset/asset.service.ts",
      'import SftpClient from "ssh2-sftp-client";\nexport const x = SftpClient;\n',
      "ADR-001",
    ],
    [
      "params hashing outside transform-params",
      "packages/cache/src/key.ts",
      'import { createHash } from "node:crypto";\nexport const x = createHash;\n',
      "ADR-004",
    ],
    [
      "console in library code",
      "packages/cache/src/redis.ts",
      'export const x = () => { console.log("hi"); };\n',
      "ENGINEERING/12",
    ],
    ["an enum", "packages/schema/src/status.ts", "export enum Status { A }\n", "ENGINEERING/04"],
    [
      "a default export",
      "packages/schema/src/thing.ts",
      "const thing = 1;\nexport default thing;\n",
      "import-x/no-default-export",
    ],
  ])("%s", async (_name, filePath, code, expected) => {
    const messages = await messagesFor(filePath, code);

    expect(messages.join("\n")).toContain(expected);
  });
});

describe("architectural lint rules stay out of the way where the code belongs", () => {
  it.each([
    [
      "storage-adapter may import a provider SDK",
      "packages/storage-adapter/src/adapters/s3.ts",
      'import { S3Client } from "@aws-sdk/client-s3";\nexport const x = S3Client;\n',
    ],
    [
      "transform-params may hash",
      "packages/transform-params/src/hash.ts",
      'import { createHash } from "node:crypto";\nexport const x = createHash;\n',
    ],
    [
      "a service may call a repository",
      "services/api/src/modules/folder/folder.service.ts",
      'import { findById } from "./folder.repository";\nexport const x = findById;\n',
    ],
  ])("%s", async (_name, filePath, code) => {
    expect(await messagesFor(filePath, code)).toEqual([]);
  });
});
