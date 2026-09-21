import { describeStorageConformance } from "./conformance";
import { MemoryStorageAdapter } from "../src/adapters/memory";

describeStorageConformance("memory (tests only)", async () => ({
  adapter: new MemoryStorageAdapter(),
}));
