import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { loadConfig } from '../config.utils';

/**
 * Constants for database configuration
 */
export const DB_CONFIG_CONSTANTS = {
  /** Default database host */
  DEFAULT_HOST: 'localhost',
  /** Default database port */
  DEFAULT_PORT: 5432,
  /** Default database name */
  DEFAULT_DB_NAME: 'form_engine',
  /** Default database user */
  DEFAULT_USER: 'admin',
  /** Default database password */
  DEFAULT_PASSWORD: 'password123',
} as const;

/**
 * Zod schema for database configuration.
 * Validates all required configuration values for database setup.
 * Defaults are applied through Zod's .default() method.
 */
export const DbConfigSchema = z.object({
  host: z
    .string()
    .min(1, 'DB_HOST is required')
    .default(DB_CONFIG_CONSTANTS.DEFAULT_HOST),
  port: z.coerce
    .number()
    .int()
    .positive()
    .default(DB_CONFIG_CONSTANTS.DEFAULT_PORT),
  dbName: z
    .string()
    .min(1, 'DB_NAME is required')
    .default(DB_CONFIG_CONSTANTS.DEFAULT_DB_NAME),
  user: z
    .string()
    .min(1, 'DB_USER is required')
    .default(DB_CONFIG_CONSTANTS.DEFAULT_USER),
  password: z
    .string()
    .min(1, 'DB_PASSWORD is required')
    .default(DB_CONFIG_CONSTANTS.DEFAULT_PASSWORD),
});

/**
 * Type representing validated database configuration.
 */
export type DbConfig = z.infer<typeof DbConfigSchema>;

/**
 * Environment variable mapping for database configuration.
 * Maps config property names to environment variable names.
 */
const DB_ENV_MAPPING = {
  host: 'DB_HOST',
  port: 'DB_PORT',
  dbName: 'DB_NAME',
  user: 'DB_USER',
  password: 'DB_PASSWORD',
} as const;

/**
 * Loads and validates database configuration from environment variables.
 * Undefined values are filtered out, allowing Zod to apply defaults.
 *
 * @param configService - NestJS ConfigService instance
 * @returns Validated database configuration with defaults applied
 * @throws Error if configuration is invalid
 */
export function loadAndValidateDbConfig(
  configService: ConfigService,
): DbConfig {
  return loadConfig(
    configService,
    DB_ENV_MAPPING,
    DbConfigSchema,
    'Invalid database configuration. Please check DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD environment variables',
  );
}
