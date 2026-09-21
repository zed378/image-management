import { AppError, errorEnvelope, successEnvelope, type ErrorCode, type ErrorDetail } from "@image-delivery/errors";
import type { FastifyReply, FastifyRequest } from "fastify";

// The only way a handler writes a response body (docs/ENGINEERING/06): a
// hand-written reply.send({...}) is how one endpoint ends up without
// request_id or with data at the top level. Handlers normally *throw*
// AppError and let the error handler respond; sendError exists for the few
// places that respond with an error without throwing (probes, not-found).

export const ok = <T>(request: FastifyRequest, reply: FastifyReply, data: T, meta?: Record<string, unknown>) =>
  reply.status(200).send(successEnvelope(data, request.id, meta));

export const created = <T>(request: FastifyRequest, reply: FastifyReply, data: T, location: string) =>
  reply.status(201).header("location", location).send(successEnvelope(data, request.id));

export const accepted = <T>(request: FastifyRequest, reply: FastifyReply, data: T) =>
  reply.status(202).send(successEnvelope(data, request.id));

export const noContent = (reply: FastifyReply) => reply.status(204).send();

export const sendError = (
  request: FastifyRequest,
  reply: FastifyReply,
  code: ErrorCode,
  details: readonly ErrorDetail[] = [],
) => {
  const err = new AppError(code, { details });
  return reply.status(err.status).send(errorEnvelope(err.code, err.publicMessage, request.id, err.details));
};
