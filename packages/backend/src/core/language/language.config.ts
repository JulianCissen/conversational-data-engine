import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { loadConfig } from '../config.utils';

/**
 * Constants for language configuration
 */
export const LANGUAGE_CONFIG_CONSTANTS = {
  /** Default language mode */
  DEFAULT_MODE: 'adaptive' as const,
  /** Default language code (ISO-639) */
  DEFAULT_LANGUAGE: 'en-GB',
} as const;

/**
 * Zod schema for language configuration.
 * Validates language settings for the application.
 * Defaults are applied through Zod's .default() method.
 */
export const LanguageConfigSchema = z.object({
  mode: z
    .enum(['adaptive', 'strict'])
    .default(LANGUAGE_CONFIG_CONSTANTS.DEFAULT_MODE),
  defaultLanguage: z
    .string()
    .default(LANGUAGE_CONFIG_CONSTANTS.DEFAULT_LANGUAGE),
});

/**
 * Type representing validated language configuration.
 */
export type LanguageConfig = z.infer<typeof LanguageConfigSchema>;

/**
 * Environment variable mapping for language configuration.
 * Maps config property names to environment variable names.
 */
const LANGUAGE_ENV_MAPPING = {
  mode: 'LANG_DEFAULT_MODE',
  defaultLanguage: 'LANG_DEFAULT_LANGUAGE',
} as const;

/**
 * Loads and validates language configuration from environment variables.
 * Undefined values are filtered out, allowing Zod to apply defaults.
 *
 * @param configService - NestJS ConfigService instance
 * @returns Validated language configuration with defaults applied
 * @throws Error if configuration is invalid
 */
export function loadAndValidateLanguageConfig(
  configService: ConfigService,
): LanguageConfig {
  return loadConfig(
    configService,
    LANGUAGE_ENV_MAPPING,
    LanguageConfigSchema,
    'Invalid language configuration. Please check LANG_DEFAULT_MODE and LANG_DEFAULT_LANGUAGE environment variables',
  );
}
