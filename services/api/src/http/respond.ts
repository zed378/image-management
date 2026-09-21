import { errorEnvelope, successEnvelope, type ErrorDetail } from "@image-delivery/errors";
import type { FastifyReply, FastifyRequest } from "fastify";

// The only way a handler writes a response body (docs/ENGINEERING/06): a
// hand-written reply.send({...}) is how one endpoint ends up without
// request_id or with data at the top level.

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
  status: number,
  code: string,
  message: string,
  details: readonly ErrorDetail[] = [],
) => reply.status(status).send(errorEnvelope(code, message, request.id, details));
