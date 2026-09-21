import { hash } from "node:crypto";

import { AppError } from "@image-delivery/errors";

import { createIdempotencyRepository } from "./idempotency.repository";

import type { Db } from "@image-delivery/db";
import type { TenantContext } from "@image-delivery/tenancy";

// Idempotent creates (docs/API/08-IDEMPOTENCY.md, P2-02 step 3). With an
// Idempotency-Key, a create runs at most once per key: a retry of the same
// request replays the stored response; the same key with a different
// request is 409 idempotency_key_reused; a retry while the first is still
// running is 409 idempotency_request_in_progress (retryable). A failed
// attempt releases the key, so the client can retry it.

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;

export type IdempotentResponse = { readonly status: number; readonly body: unknown };
export type IdempotentOutcome = IdempotentResponse & { readonly replayed: boolean };

/** SHA-256 over the parts that make two requests "the same request". */
export const requestFingerprint = (...parts: readonly string[]): string =>
  hash("sha256", parts.join("\u0000"), "hex");

/** SHA-256 of a request body's bytes, for requestFingerprint. */
export const bodyFingerprint = (body: Buffer): string => hash("sha256", body, "hex");

export const createIdempotencyService = (db: Db) => {
  const keys = createIdempotencyRepository(db);

  const run = async (
    ctx: TenantContext,
    key: string | undefined,
    requestHash: string,
    work: () => Promise<IdempotentResponse>,
  ): Promise<IdempotentOutcome> => {
    if (key === undefined) return { ...(await work()), replayed: false };
    if (!KEY_PATTERN.test(key)) {
      throw new AppError("validation_failed", {
        details: [{ field: "Idempotency-Key", reason: "invalid" }],
      });
    }

    if (!(await keys.claim(ctx, key, requestHash, IDEMPOTENCY_TTL_SECONDS))) {
      const existing = await keys.find(ctx, key);
      if (!existing) return run(ctx, key, requestHash, work); // released meanwhile
      if (existing.requestHash !== requestHash) throw new AppError("idempotency_key_reused");
      if (existing.status === "in_progress") throw new AppError("idempotency_request_in_progress");
      return {
        status: existing.responseStatus ?? 200,
        body: existing.responseBody,
        replayed: true,
      };
    }

    try {
      const response = await work();
      await keys.complete(ctx, key, response.status, response.body);
      return { ...response, replayed: false };
    } catch (err) {
      await keys.release(ctx, key);
      throw err;
    }
  };

  return { run };
};

export type IdempotencyService = ReturnType<typeof createIdempotencyService>;
