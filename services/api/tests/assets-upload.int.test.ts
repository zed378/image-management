import { crc32 } from "node:zlib";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createLogger } from "@image-delivery/logger";
import {
  MemoryStorageAdapter,
  StorageUnavailableError,
  type StorageAdapter,
} from "@image-delivery/storage-adapter";
import { PERMISSIONS, systemContext, type Permission } from "@image-delivery/tenancy";
import {
  createTestDatabase,
  seedProject,
  seedTenant,
  type SeededTenant,
  type TestDatabase,
} from "@image-delivery/test-utils";

import { multipartBody, smallPng } from "./support/upload";
import { buildApp } from "../src/app";
import { createApiKeyService, type ApiKeyService } from "../src/modules/api-keys/api-key.service";
import { createAssetModule } from "../src/modules/assets/asset.module";

import type { FastifyInstance } from "fastify";

// P2-02: direct multipart upload, end to end against a real database.
// Definition of Done:
//   - a spoofed extension / Content-Type is rejected (the bytes decide);
//   - absurd declared dimensions are rejected before any decode (a crafted
//     file), and nothing is stored;
//   - the isolation case exists (tests/isolation/cases.ts).

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

let t: TestDatabase;
let apiKeys: ApiKeyService;
let storage: MemoryStorageAdapter;
let app: FastifyInstance;
let s: SeededTenant;
let key: string;

const issue = async (tenant: SeededTenant, permissions: Permission[], projectIds?: string[]) =>
  (
    await apiKeys.create(systemContext(tenant.tenantId), tenant.applicationId, {
      name: "uploader",
      environment: "live",
      permissions,
      all_projects: projectIds === undefined,
      project_ids: projectIds ?? [],
    })
  ).plaintext;

const upload = (
  body: { payload: Buffer; headers: Record<string, string> },
  options: { key?: string; projectId?: string; idempotencyKey?: string } = {},
) =>
  app.inject({
    method: "POST",
    url: `/v1/projects/${options.projectId ?? s.projectId}/assets`,
    headers: {
      authorization: `Bearer ${options.key ?? key}`,
      ...body.headers,
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
    },
    payload: body.payload,
  });

const codeOf = (res: Awaited<ReturnType<FastifyInstance["inject"]>>) =>
  res.json<{ error: { code: string } }>().error.code;

const assetCount = async () =>
  (
    await t.db
      .selectFrom("assets")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("project_id", "=", s.projectId)
      .executeTakeFirstOrThrow()
  ).n;

/** A syntactically valid PNG whose header declares width x height. */
const pngDeclaring = (width: number, height: number): Buffer => {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const buildWith = (store: StorageAdapter) =>
  buildApp({
    logger: createLogger({ service: "api", version: "test", level: "silent" }),
    readinessChecks: {},
    apiKeys,
    assets: createAssetModule({ db: t.db, storage: store }),
  });

beforeAll(async () => {
  t = await createTestDatabase(inject("postgresAdminUrl"));
  apiKeys = createApiKeyService({ db: t.db, pepper: PEPPER });
  storage = new MemoryStorageAdapter();
  app = await buildWith(storage);
  s = await seedTenant(t.db);
  key = await issue(s, [...PERMISSIONS]);
});
afterAll(async () => {
  await app.close();
  await t.destroy();
});

describe("a valid upload", () => {
  it("creates the asset and its first version, stores the original, and answers 201", async () => {
    const png = await smallPng(40, 30);

    const res = await upload(
      multipartBody(png, {
        filename: "beach.png",
        fields: { alt_text: "A beach", visibility: "public" },
      }),
    );

    expect(res.statusCode).toBe(201);
    const asset = res.json<{
      data: {
        id: string;
        status: string;
        visibility: string;
        original_filename: string;
        current_version: {
          id: string;
          version: number;
          content_type: string;
          width: number;
          height: number;
          byte_size: number;
        };
      };
    }>().data;
    expect(res.headers.location).toBe(`/v1/projects/${s.projectId}/assets/${asset.id}`);
    expect(asset).toMatchObject({
      status: "processing",
      visibility: "public",
      original_filename: "beach.png",
      current_version: {
        version: 1,
        content_type: "image/png",
        width: 40,
        height: 30,
        byte_size: png.length,
      },
    });

    const version = await t.db
      .selectFrom("asset_versions")
      .select(["storage_key", "status", "checksum_sha256"])
      .where("id", "=", asset.current_version.id)
      .executeTakeFirstOrThrow();
    expect(version.status).toBe("ready");
    expect(version.storage_key).toBe(
      `${s.tenantId}/${s.projectId}/originals/${asset.id}/${asset.current_version.id}.png`,
    );
    const stored = await storage.stat(version.storage_key);
    expect(stored).toMatchObject({ byteSize: png.length, contentType: "image/png" });

    const fetched = await app.inject({
      method: "GET",
      url: `/v1/projects/${s.projectId}/assets/${asset.id}`,
      headers: { authorization: `Bearer ${key}` },
    });
    expect(fetched.statusCode).toBe(200);
  });

  it("keeps a hostile filename as display text only", async () => {
    const res = await upload(
      multipartBody(await smallPng(), { filename: "../../etc/pass\u0007wd.png" }),
    );

    expect(res.statusCode).toBe(201);
    const data = res.json<{
      data: { original_filename: string; current_version: { id: string } };
    }>().data;
    // The multipart parser keeps only the basename; we strip control characters.
    expect(data.original_filename).toBe("passwd.png");
    const version = await t.db
      .selectFrom("asset_versions")
      .select("storage_key")
      .where("id", "=", data.current_version.id)
      .executeTakeFirstOrThrow();
    expect(version.storage_key).not.toContain("..");
    expect(version.storage_key).not.toContain("passwd");
  });
});

describe("rejected uploads leave nothing behind", () => {
  it("rejects a spoofed file: HTML named photo.jpg, declared image/jpeg (P2-02 DoD)", async () => {
    const before = await assetCount();

    const res = await upload(
      multipartBody(Buffer.from("<html><script>alert(1)</script></html>"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      }),
    );

    expect(res.statusCode).toBe(415);
    expect(codeOf(res)).toBe("unsupported_media_type");
    expect(await assetCount()).toBe(before);
  });

  it("rejects a crafted file declaring 100000x100000 before decoding it (P2-02 DoD)", async () => {
    const before = await assetCount();
    const objectsBefore = (await storage.list("")).objects.length;

    const started = performance.now();
    const res = await upload(
      multipartBody(pngDeclaring(100_000, 100_000), { filename: "bomb.png" }),
    );

    expect(res.statusCode).toBe(422);
    expect(codeOf(res)).toBe("image_dimensions_exceeded");
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(await assetCount()).toBe(before);
    expect((await storage.list("")).objects).toHaveLength(objectsBefore);
  });

  it("rejects a form without a file, and an unknown field", async () => {
    const noFile = await app.inject({
      method: "POST",
      url: `/v1/projects/${s.projectId}/assets`,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "multipart/form-data; boundary=x",
      },
      payload: "--x--\r\n",
    });
    expect(noFile.statusCode).toBe(400);

    const unknownField = await upload(
      multipartBody(await smallPng(), { fields: { tenant_id: s.tenantId } }),
    );
    expect(unknownField.statusCode).toBe(400);
    expect(codeOf(unknownField)).toBe("validation_failed");
  });

  it("answers 404 for a folder that is not in the project", async () => {
    const res = await upload(
      multipartBody(await smallPng(), { fields: { folder_id: "01HZZZZZZZZZZZZZZZZZZZZZZZ" } }),
    );

    expect(res.statusCode).toBe(404);
    expect(codeOf(res)).toBe("folder_not_found");
  });

  it("rolls the rows back when storage is down, and answers 503", async () => {
    class DownStorage extends MemoryStorageAdapter {
      override put(): never {
        throw new StorageUnavailableError("disk gone");
      }
    }
    const down = await buildWith(new DownStorage());
    const before = await assetCount();
    const body = multipartBody(await smallPng());

    const res = await down.inject({
      method: "POST",
      url: `/v1/projects/${s.projectId}/assets`,
      headers: { authorization: `Bearer ${key}`, ...body.headers },
      payload: body.payload,
    });

    expect(res.statusCode).toBe(503);
    expect(codeOf(res)).toBe("storage_unavailable");
    expect(await assetCount()).toBe(before);
    await down.close();
  });
});

describe("project access", () => {
  it("answers 404 for a project the key does not cover", async () => {
    const other = await seedProject(t.db, s);
    const narrow = await issue(s, ["asset:create"], [s.projectId]);

    const res = await upload(multipartBody(await smallPng()), { key: narrow, projectId: other });

    expect(res.statusCode).toBe(404);
    expect(codeOf(res)).toBe("project_not_found");
  });

  it("refuses uploads into an archived project", async () => {
    const archived = await seedProject(t.db, s);
    await t.db
      .updateTable("projects")
      .set({ status: "archived" })
      .where("id", "=", archived)
      .execute();

    const res = await upload(multipartBody(await smallPng()), { projectId: archived });

    expect(res.statusCode).toBe(409);
    expect(codeOf(res)).toBe("invalid_state");
  });

  it("requires asset:create", async () => {
    const reader = await issue(s, ["asset:read"]);

    expect((await upload(multipartBody(await smallPng()), { key: reader })).statusCode).toBe(403);
  });
});

describe("Idempotency-Key (docs/API/08)", () => {
  it("replays the first response for a retry of the same request, creating one asset", async () => {
    const png = await smallPng(20, 20);
    const before = await assetCount();

    const first = await upload(multipartBody(png, { filename: "a.png" }), {
      idempotencyKey: "retry-1",
    });
    const second = await upload(multipartBody(png, { filename: "a.png" }), {
      idempotencyKey: "retry-1",
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.json<{ data: { id: string } }>().data.id).toBe(
      first.json<{ data: { id: string } }>().data.id,
    );
    expect(await assetCount()).toBe(before + 1);
  });

  it("refuses the same key with a different request", async () => {
    await upload(multipartBody(await smallPng(10, 10)), { idempotencyKey: "reuse-1" });

    const res = await upload(multipartBody(await smallPng(11, 11)), { idempotencyKey: "reuse-1" });

    expect(res.statusCode).toBe(409);
    expect(codeOf(res)).toBe("idempotency_key_reused");
  });

  it("releases the key when the request fails, so it can be retried", async () => {
    const bad = await upload(multipartBody(Buffer.from("not an image")), {
      idempotencyKey: "fail-1",
    });
    expect(bad.statusCode).toBe(415);

    const good = await upload(multipartBody(await smallPng()), { idempotencyKey: "fail-1" });
    expect(good.statusCode).toBe(201);
  });
});
