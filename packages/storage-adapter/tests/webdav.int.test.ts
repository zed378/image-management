import { GenericContainer, Wait } from "testcontainers";

import { describeStorageConformance } from "./conformance";
import { WebDavStorageAdapter } from "../src/adapters/webdav";

// WebDAV (RFC 4918), against hacdias/webdav.
const CONFIG = `
address: 0.0.0.0
port: 6065
directory: /data
permissions: CRUD
users:
  - username: images
    password: images-test-password
`;

describeStorageConformance("webdav (hacdias/webdav)", async () => {
  const server = await new GenericContainer("ghcr.io/hacdias/webdav:v5.8.0")
    .withCopyContentToContainer([
      { content: CONFIG, target: "/etc/webdav/config.yml" },
      // The image has no shell and no /data; copying a file creates the
      // directory. Without it every MKCOL returns 409 Conflict.
      { content: "", target: "/data/.keep" },
    ])
    .withCommand(["--config", "/etc/webdav/config.yml"])
    .withExposedPorts(6065)
    // The image has no shell, so the port-probe strategy (which execs inside
    // the container) cannot work; wait for the server's own log line.
    .withWaitStrategy(Wait.forLogMessage(/listening/))
    .start();

  return {
    adapter: new WebDavStorageAdapter({
      url: `http://${server.getHost()}:${server.getMappedPort(6065)}`,
      username: "images",
      password: "images-test-password",
      root: "/",
    }),
    teardown: async () => {
      await server.stop();
    },
  };
});
