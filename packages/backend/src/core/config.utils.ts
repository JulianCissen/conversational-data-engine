import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * Generic environment variable mapping type.
 * Maps config property names to their raw environment values.
 */
export type EnvMapping<T> = {
  [K in keyof T]: T[K] | undefined;
};

/**
 * Configuration builder class that allows chaining property additions
 * and only includes defined (non-undefined) values in the final config.
 */
export class ConfigBuilder<T extends Record<string, any>> {
  private config: Partial<T> = {};

  /**
   * Add a property to the config if the value is defined.
   * @param key - Property key
   * @param value - Property value (undefined values are skipped)
   * @returns this for chaining
   */
  add<K extends keyof T>(key: K, value: T[K] | undefined): this {
    if (value !== undefined) {
      this.config[key] = value;
    }
    return this;
  }

  /**
   * Build the final config object (only includes defined properties).
   * @returns Partial config object with only defined values
   */
  build(): Partial<T> {
    return this.config;
  }
}

/**
 * Generic configuration loader that:
 * 1. Loads raw values from environment variables
 * 2. Filters out undefined values
 * 3. Validates and applies defaults through Zod schema
 *
 * @param configService - NestJS ConfigService instance
 * @param envMapping - Object mapping config keys to environment variable names
 * @param schema - Zod schema with validation and defaults
 * @param errorMessage - Custom error message for validation failures
 * @returns Validated configuration with defaults applied by Zod
 * @throws Error if configuration is invalid
 *
 * @example
 * ```typescript
 * const config = loadConfig(
 *   configService,
 *   {
 *     apiKey: 'LLM_API_KEY',
 *     temperature: 'LLM_TEMPERATURE',
 *   },
 *   LlmConfigSchema,
 *   'Invalid LLM configuration'
 * );
 * ```
 */
export function loadConfig<T extends z.ZodTypeAny>(
  configService: ConfigService,
  envMapping: Record<string, string>,
  schema: T,
  errorMessage: string,
): z.infer<T> {
  // Build config with only defined values using ConfigBuilder
  const builder = new ConfigBuilder<Record<string, any>>();

  for (const [configKey, envVarName] of Object.entries(envMapping)) {
    const value = configService.get(envVarName);
    builder.add(configKey, value);
  }

  const rawConfig = builder.build();

  try {
    // Zod will apply defaults for missing properties
    return schema.parse(rawConfig);
  } catch (error) {
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}

/**
 * Helper to remove undefined properties from an object.
 * Useful for preparing raw config before Zod validation.
 *
 * @param obj - Object with potentially undefined properties
 * @returns New object with undefined properties removed
 *
 * @example
 * ```typescript
 * const raw = { a: 1, b: undefined, c: 'hello' };
 * const clean = removeUndefined(raw);
 * // Result: { a: 1, c: 'hello' }
 * ```
 */
export function removeUndefined<T extends Record<string, any>>(
  obj: T,
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }

  return result;
}
