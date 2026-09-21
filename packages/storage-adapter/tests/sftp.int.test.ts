import { GenericContainer, Wait } from "testcontainers";

import { describeStorageConformance } from "./conformance";
import { SftpStorageAdapter } from "../src/adapters/sftp";

// SFTP over SSH, against an OpenSSH server (atmoz/sftp). The user is chrooted
// into its home directory, so the writable directory is /upload.
describeStorageConformance("sftp (OpenSSH)", async () => {
  const server = await new GenericContainer("atmoz/sftp:alpine")
    .withCommand(["images:images-test-password:1001:1001:upload"])
    .withExposedPorts(22)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  return {
    adapter: new SftpStorageAdapter({
      host: server.getHost(),
      port: server.getMappedPort(22),
      username: "images",
      password: "images-test-password",
      root: "/upload",
    }),
    teardown: async () => {
      await server.stop();
    },
  };
});
