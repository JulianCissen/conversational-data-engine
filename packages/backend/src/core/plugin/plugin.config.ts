import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { loadConfig } from '../config.utils';
import * as path from 'path';

/**
 * Zod schema for plugin configuration.
 * Validates all required configuration values for plugin setup.
 * Defaults are applied through Zod's .default() method.
 */
export const PluginConfigSchema = z.object({
  pluginsDirectory: z.string().default(path.resolve(process.cwd(), 'plugins')),
});

/**
 * Type representing validated plugin configuration.
 */
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Environment variable mapping for plugin configuration.
 * Maps config property names to environment variable names.
 */
const PLUGIN_ENV_MAPPING = {
  pluginsDirectory: 'PLUGINS_DIRECTORY',
} as const;

/**
 * Loads and validates plugin configuration from environment variables.
 * Undefined values are filtered out, allowing Zod to apply defaults.
 *
 * @param configService - NestJS ConfigService instance
 * @returns Validated plugin configuration with defaults applied
 * @throws Error if configuration is invalid
 */
export function loadAndValidatePluginConfig(
  configService: ConfigService,
): PluginConfig {
  return loadConfig(
    configService,
    PLUGIN_ENV_MAPPING,
    PluginConfigSchema,
    'Invalid plugin configuration. Please check PLUGINS_DIRECTORY environment variable',
  );
}
