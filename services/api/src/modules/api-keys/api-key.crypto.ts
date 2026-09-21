import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { newId } from "@image-delivery/schema";

import {
  API_KEY_PREFIX,
  API_KEY_SECRET_BYTES,
  API_KEY_SECRET_LENGTH,
  type API_KEY_ENVIRONMENTS,
} from "./api-key.constants";

// The key format and its hash (ADR-022 point 4, docs/SECURITY/04).
//
//   ak_live_01J8Z3K4M5N6P7Q8R9S0T1V2W3_<43 base64url characters>
//   \/ \__/ \________________________/ \_________________________/
//   |   |        public key id                 secret (256 bits)
//   |   environment
//   prefix
//
// The id is public: it is the row's primary key, safe to log, and it lets
// authentication find the row by index before any tenant is known. Only
// HMAC-SHA256(pepper, id "." secret) is stored. Binding the id into the MAC
// means a stored hash cannot be moved to another row.

export type ApiKeyEnvironment = (typeof API_KEY_ENVIRONMENTS)[number];

export type ParsedApiKey = {
  readonly environment: ApiKeyEnvironment;
  readonly id: string;
  readonly secret: string;
};

const KEY_PATTERN = new RegExp(
  `^${API_KEY_PREFIX}_(live|test)_([0-9A-HJKMNP-TV-Z]{26})_([A-Za-z0-9_-]{${API_KEY_SECRET_LENGTH}})$`,
  "u",
);

export const generateApiKey = (
  environment: ApiKeyEnvironment,
): ParsedApiKey & { readonly plaintext: string } => {
  const id = newId();
  const secret = randomBytes(API_KEY_SECRET_BYTES).toString("base64url");
  return { environment, id, secret, plaintext: `${API_KEY_PREFIX}_${environment}_${id}_${secret}` };
};

/** null for anything that is not a well-formed key; never throws. */
export const parseApiKey = (plaintext: string): ParsedApiKey | null => {
  const match = KEY_PATTERN.exec(plaintext);
  if (!match) return null;
  const [, environment, id, secret] = match;
  if (!environment || !id || !secret) return null;
  return { environment: environment as ApiKeyEnvironment, id, secret };
};

export const hashApiKeySecret = (pepper: string, id: string, secret: string): string =>
  createHmac("sha256", pepper).update(`${id}.${secret}`).digest("hex");

/** Constant-time comparison of a presented secret against a stored hash. */
export const verifyApiKeySecret = (
  pepper: string,
  id: string,
  secret: string,
  storedHash: string,
): boolean => {
  const presented = Buffer.from(hashApiKeySecret(pepper, id, secret), "hex");
  const stored = Buffer.from(storedHash, "hex");
  // Both are SHA-256 digests; unequal lengths only for a corrupt row.
  return presented.length === stored.length && timingSafeEqual(presented, stored);
};

/** A well-formed hash of nothing, compared against when no row exists, so timing does not reveal existence. */
export const DECOY_HASH = "0".repeat(64);

/** The non-secret part of a key, for display and logs: `ak_live_01J8...`. */
export const displayPrefix = (environment: ApiKeyEnvironment, id: string): string =>
  `${API_KEY_PREFIX}_${environment}_${id}`;
