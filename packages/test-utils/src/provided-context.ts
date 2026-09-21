// Values the integration global setup provides to test files through
// Vitest's provide/inject. Imported by index.ts so that any test importing
// @image-delivery/test-utils sees these keys in `inject()`.
declare module "vitest" {
  export interface ProvidedContext {
    postgresAdminUrl: string;
    redisUrl: string;
    s3Endpoint: string;
  }
}

export {};
