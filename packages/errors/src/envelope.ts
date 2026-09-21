// The response envelope (docs/API/01-API-STANDARDS.md). Framework-free: the
// api's reply helpers wrap these; nothing here knows about Fastify.
//
//   success:  { "data": ..., "meta": { "request_id": "...", ... } }
//   error:    { "error": { "code", "message", "details", "request_id" } }
//
// A success body never contains `error`; an error body never contains `data`.

export type ResponseMeta = { readonly request_id: string } & Readonly<Record<string, unknown>>;

export type SuccessEnvelope<T> = {
  readonly data: T;
  readonly meta: ResponseMeta;
};

export type ErrorDetail = {
  readonly field?: string;
  readonly reason: string;
};

export type ErrorEnvelope = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: readonly ErrorDetail[];
    readonly request_id: string;
  };
};

export const successEnvelope = <T>(
  data: T,
  requestId: string,
  meta: Readonly<Record<string, unknown>> = {},
): SuccessEnvelope<T> => ({ data, meta: { ...meta, request_id: requestId } });

export const errorEnvelope = (
  code: string,
  message: string,
  requestId: string,
  details: readonly ErrorDetail[] = [],
): ErrorEnvelope => ({ error: { code, message, details, request_id: requestId } });
