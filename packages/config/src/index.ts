// Typed, validated environment configuration (P0-04,
// docs/DEVOPS/03-CONFIGURATION.md). The only package permitted to read
// process.env; every other package receives configuration as an argument.

export { ConfigError, type ConfigIssue } from "./config-error";
export { parseConfig, withDotEnv, type RawEnv } from "./load-config";
export {
  LOG_LEVELS,
  NODE_ENVS,
  DEFAULT_DEV_STORAGE_ROOT,
  STORAGE_PROVIDERS,
  databaseFragment,
  processFragment,
  redisFragment,
  refineStorage,
  storageFragment,
  toDatabaseConfig,
  toProcessConfig,
  toRedisConfig,
  toStorageConfig,
  type DatabaseConfig,
  type LogLevel,
  type NodeEnv,
  type ProcessConfig,
  type RedisConfig,
  type StorageConfig,
  type StorageProviderName,
} from "./fragments";
