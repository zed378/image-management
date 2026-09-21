import { MemoryStorageAdapter } from "../src/adapters/memory";
import { describeStorageConformance } from "./conformance";

describeStorageConformance("memory (tests only)", async () => ({ adapter: new MemoryStorageAdapter() }));
