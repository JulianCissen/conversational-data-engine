import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { loadConfig } from '../config.utils';

/**
 * Constants for LLM configuration
 */
export const LLM_CONFIG_CONSTANTS = {
  /** Default temperature for LLM responses */
  DEFAULT_TEMPERATURE: 0,
  /** Minimum allowed temperature */
  MIN_TEMPERATURE: 0,
  /** Maximum allowed temperature */
  MAX_TEMPERATURE: 2,
  /** Minimum length for API key */
  MIN_API_KEY_LENGTH: 1,
  /** Minimum length for model name */
  MIN_MODEL_NAME_LENGTH: 1,
} as const;

/**
 * Zod schema for LLM configuration.
 * Validates all required configuration values for LLM setup.
 * Defaults are applied through Zod's .default() method.
 */
export const LlmConfigSchema = z.object({
  apiKey: z
    .string()
    .min(LLM_CONFIG_CONSTANTS.MIN_API_KEY_LENGTH, 'LLM_API_KEY is required'),
  baseURL: z.url('LLM_BASE_URL must be a valid URL'),
  modelName: z
    .string()
    .min(LLM_CONFIG_CONSTANTS.MIN_MODEL_NAME_LENGTH, 'LLM_MODEL is required'),
  temperature: z
    .number()
    .min(LLM_CONFIG_CONSTANTS.MIN_TEMPERATURE)
    .max(LLM_CONFIG_CONSTANTS.MAX_TEMPERATURE)
    .default(LLM_CONFIG_CONSTANTS.DEFAULT_TEMPERATURE),
});

/**
 * Type representing validated LLM configuration.
 */
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

/**
 * Environment variable mapping for LLM configuration.
 * Maps config property names to environment variable names.
 */
const LLM_ENV_MAPPING = {
  apiKey: 'LLM_API_KEY',
  baseURL: 'LLM_BASE_URL',
  modelName: 'LLM_MODEL',
  temperature: 'LLM_TEMPERATURE',
} as const;

/**
 * Loads and validates LLM configuration from environment variables.
 * Undefined values are filtered out, allowing Zod to apply defaults.
 *
 * @param configService - NestJS ConfigService instance
 * @returns Validated LLM configuration with defaults applied
 * @throws Error if configuration is invalid
 */
export function loadAndValidateLlmConfig(
  configService: ConfigService,
): LlmConfig {
  return loadConfig(
    configService,
    LLM_ENV_MAPPING,
    LlmConfigSchema,
    'Invalid LLM configuration. Please check LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL environment variables',
  );
}
