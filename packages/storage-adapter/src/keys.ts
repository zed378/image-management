import { StorageKeyError } from "./errors";

// One key grammar for every backend. On filesystem-like backends (local disk,
// NFS, SMB, SFTP, WebDAV) a key becomes a path, so this is also the
// path-traversal defence -- which is why it is strict and shared rather than
// left to each adapter.
//
//   key      = segment *( "/" segment )
//   segment  = 1*( ALPHA / DIGIT / "-" / "_" / "=" / "." ), not starting with "."
//
// Rejected: empty segments (leading/trailing/double slash), "." and ".."
// segments, any segment starting with "." (reserves .meta and temp files),
// backslashes, colons (Windows alternate data streams), control characters,
// spaces, and Windows device names (CON, NUL, COM1, ...).

const MAX_KEY_LENGTH = 1024;
const SEGMENT = /^[A-Za-z0-9_=-][A-Za-z0-9._=-]*$/;
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

export const validateObjectKey = (key: string): string => {
  if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new StorageKeyError(`object key must be 1-${MAX_KEY_LENGTH} characters`);
  }
  for (const segment of key.split("/")) {
    if (!SEGMENT.test(segment)) {
      throw new StorageKeyError("object key contains an invalid segment");
    }
    const stem = segment.split(".", 1)[0] ?? "";
    if (WINDOWS_DEVICE.test(stem)) {
      throw new StorageKeyError("object key segment is a reserved device name");
    }
  }
  return key;
};

/**
 * A list prefix may be empty or end in "/" (a partial key is also allowed).
 * It must not be able to escape the root, so it follows the same segment
 * rules except that the final segment may be empty.
 */
export const validatePrefix = (prefix: string): string => {
  if (prefix === "") return prefix;
  const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  validateObjectKey(trimmed);
  return prefix;
};
