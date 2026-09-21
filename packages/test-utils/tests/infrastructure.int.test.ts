import net from "node:net";

import { describe, expect, inject, it } from "vitest";

// Proves the integration harness itself: every dependency the platform needs
// is reachable before any real integration test relies on it.

const reachable = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 3_000 });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });

describe("integration test infrastructure", () => {
  it("provides a reachable PostgreSQL", async () => {
    const url = new URL(inject("postgresAdminUrl"));

    expect(await reachable(url.hostname, Number(url.port))).toBe(true);
  });

  it("provides a reachable Redis", async () => {
    const url = new URL(inject("redisUrl"));

    expect(await reachable(url.hostname, Number(url.port))).toBe(true);
  });

  it("provides a live MinIO", async () => {
    const res = await fetch(`${inject("s3Endpoint")}/minio/health/live`);

    expect(res.status).toBe(200);
  });
});
