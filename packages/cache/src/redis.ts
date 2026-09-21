import { Redis } from "ioredis";

export type RedisClient = Redis;

/**
 * A Redis connection for application use (cache, rate limits, locks).
 * BullMQ creates its own connections with the settings it requires
 * (packages/queue); do not share this one with a queue worker.
 */
export const createRedisClient = (
  url: string,
  connectionName: string,
  onError: (err: Error) => void = () => undefined,
): RedisClient => {
  const client = new Redis(url, {
    connectionName,
    // Fail a command rather than retry it forever when Redis is gone; the
    // caller (a readiness probe, a cache read) decides what to do.
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    lazyConnect: true,
  });
  // Connection errors are expected during a Redis restart; ioredis reconnects
  // on its own. Route them to the logger instead of ioredis's own stderr
  // "Unhandled error event" output.
  client.on("error", onError);
  return client;
};
