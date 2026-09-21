// Every adapter translates its provider's failures into these classes at the
// adapter boundary. A provider-specific error (NoSuchKey, ENOENT, a 404 from
// a WebDAV server) reaching a caller means the abstraction has leaked
// (docs/ENGINEERING/01, section 10).

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The object does not exist. */
export class StorageNotFoundError extends StorageError {
  readonly key: string;
  constructor(key: string, options?: { cause?: unknown }) {
    super(`object not found: ${key}`, options);
    this.key = key;
  }
}

/** The key is not a valid object key; nothing was attempted. */
export class StorageKeyError extends StorageError {}

/** The adapter cannot perform this operation (e.g. native presign). */
export class StorageCapabilityError extends StorageError {}

/** The backend is unreachable or failed; the operation may succeed on retry. */
export class StorageUnavailableError extends StorageError {}

/** A presigned-proxy token is malformed, tampered, expired, or for another key/method. */
export class StorageTokenError extends StorageError {}
