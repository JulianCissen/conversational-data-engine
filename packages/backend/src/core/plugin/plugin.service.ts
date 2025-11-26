import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PluginContext, PluginResult, PluginHook } from '@conversational-data-engine/plugin-builder';
import { PluginConfig, loadAndValidatePluginConfig } from './plugin.config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Metadata describing a loaded plugin.
 */
interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  entry: string;
}

/**
 * Represents a loaded plugin instance with its metadata and implementation.
 */
interface LoadedPlugin {
  metadata: PluginMetadata;
  instance: PluginHook;
}

/**
 * Service responsible for loading and executing plugins.
 * Plugins are loaded from a static directory defined in configuration.
 */
@Injectable()
export class PluginManagerService implements OnModuleInit {
  private readonly logger = new Logger(PluginManagerService.name);
  private readonly plugins = new Map<string, LoadedPlugin>();
  private readonly config: PluginConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.resolveConfig();
  }

  /**
   * Load configuration from environment variables and validate with Zod.
   * @returns Validated plugin configuration
   * @throws Error if configuration is invalid
   */
  private resolveConfig(): PluginConfig {
    return loadAndValidatePluginConfig(this.configService);
  }

  /**
   * Initialize the plugin system by scanning and loading all plugins
   * from the configured plugins directory.
   */
  async onModuleInit() {
    this.logger.log(`Loading plugins from: ${this.config.pluginsDirectory}`);
    await this.loadPlugins();
  }

  /**
   * Scan the plugins directory and load all valid plugins.
   */
  private async loadPlugins(): Promise<void> {
    if (!fs.existsSync(this.config.pluginsDirectory)) {
      this.logger.warn(
        `Plugins directory does not exist: ${this.config.pluginsDirectory}`,
      );
      return;
    }

    const entries = fs.readdirSync(this.config.pluginsDirectory, {
      withFileTypes: true,
    });
    const pluginDirs = entries.filter((entry) => entry.isDirectory());

    for (const dir of pluginDirs) {
      const pluginPath = path.join(this.config.pluginsDirectory, dir.name);
      await this.loadPlugin(pluginPath);
    }

    this.logger.log(`Loaded ${this.plugins.size} plugin(s)`);
  }

  /**
   * Load a single plugin from a directory.
   * Expects a plugin.json manifest and the specified entry file.
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');

      if (!fs.existsSync(manifestPath)) {
        this.logger.warn(
          `Skipping plugin: No plugin.json found in ${pluginPath}`,
        );
        return;
      }

      const manifest: PluginMetadata = JSON.parse(
        fs.readFileSync(manifestPath, 'utf-8'),
      );

      if (!manifest.id || !manifest.entry) {
        this.logger.warn(
          `Skipping plugin: Invalid manifest in ${manifestPath}`,
        );
        return;
      }

      const entryPath = path.join(pluginPath, manifest.entry);

      if (!fs.existsSync(entryPath)) {
        this.logger.warn(
          `Skipping plugin ${manifest.id}: Entry file not found at ${entryPath}`,
        );
        return;
      }

      // Convert to file:// URL for dynamic import (required on Windows)
      const fileUrl = new URL(`file:///${entryPath.replace(/\\/g, '/')}`).href;

      // Dynamically import the plugin module
      const pluginModule = await import(fileUrl);
      
      // Handle various module export structures:
      // - ESM: pluginModule.default
      // - CommonJS with named + default export: pluginModule.default.default
      // - Direct export: pluginModule
      let pluginInstance = pluginModule.default || pluginModule;
      
      // If we got a module wrapper with another default, unwrap it
      if (pluginInstance && pluginInstance.default && typeof pluginInstance.default === 'object') {
        pluginInstance = pluginInstance.default;
      }

      this.plugins.set(manifest.id, {
        metadata: manifest,
        instance: pluginInstance,
      });

      this.logger.log(
        `Loaded plugin: ${manifest.name} (${manifest.id}) v${manifest.version}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load plugin from ${pluginPath}: ${error.message}`,
      );
    }
  }

  /**
   * Execute the onStart hook for specified plugins.
   */
  async executeStart(
    pluginInstanceIds: string[],
    context: PluginContext,
    blueprint: any,
  ): Promise<PluginResult> {
    return this.executeHook('onStart', pluginInstanceIds, context, blueprint);
  }

  /**
   * Execute the onFieldValidated hook for specified plugins.
   * Returns merged slot updates from all executed plugins.
   * Respects triggerOnField filtering if configured.
   */
  async executeFieldValidated(
    pluginInstanceIds: string[],
    context: PluginContext,
    blueprint: any,
  ): Promise<PluginResult> {
    // Filter plugins based on triggerOnField configuration
    const filteredInstanceIds = pluginInstanceIds.filter((instanceId) => {
      const pluginConfig = blueprint.plugins.find(
        (p: any) => (p.instanceId || p.id) === instanceId,
      );
      
      if (!pluginConfig) return true; // Execute if config not found
      
      // If triggerOnField is set, only execute if it matches the current field
      if (pluginConfig.triggerOnField) {
        return pluginConfig.triggerOnField === context.fieldId;
      }
      
      return true; // Execute if no filter is set
    });

    return this.executeHook('onFieldValidated', filteredInstanceIds, context, blueprint);
  }

  /**
   * Execute the onConversationComplete hook for specified plugins.
   */
  async executeConversationComplete(
    pluginInstanceIds: string[],
    context: PluginContext,
    blueprint: any,
  ): Promise<PluginResult> {
    return this.executeHook('onConversationComplete', pluginInstanceIds, context, blueprint);
  }

  /**
   * Generic method to execute a specific hook across multiple plugins.
   * Collects and merges slot updates from all plugins.
   */
  private async executeHook(
    hookName: string,
    pluginInstanceIds: string[],
    context: PluginContext,
    blueprint: any,
  ): Promise<PluginResult> {
    const mergedResult: PluginResult = {
      slotUpdates: {},
      metadata: {},
    };

    for (const instanceId of pluginInstanceIds) {
      // Find the plugin config by instanceId or id
      const pluginConfig = blueprint.plugins.find(
        (p: any) => (p.instanceId || p.id) === instanceId,
      );

      if (!pluginConfig) {
        const errorMessage = `Plugin instance not found in blueprint: ${instanceId}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Get the actual plugin by its type id
      const plugin = this.plugins.get(pluginConfig.id);

      if (!plugin) {
        const errorMessage = `Plugin type not found: ${pluginConfig.id}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      const hookFn = plugin.instance[hookName];

      if (typeof hookFn !== 'function') {
        this.logger.debug(
          `Plugin instance ${instanceId} (${pluginConfig.id}) does not implement ${hookName}, skipping`,
        );
        continue;
      }

      try {
        this.logger.debug(`Executing ${hookName} for plugin instance: ${instanceId} (${pluginConfig.id})`);

        const result: PluginResult = await hookFn.call(
          plugin.instance,
          context,
        );

        // Merge slot updates
        if (result?.slotUpdates) {
          mergedResult.slotUpdates = {
            ...mergedResult.slotUpdates,
            ...result.slotUpdates,
          };
        }

        // Collect metadata
        if (result?.metadata) {
          if (!mergedResult.metadata) {
            mergedResult.metadata = {};
          }
          mergedResult.metadata[instanceId] = result.metadata;
        }
      } catch (error) {
        const errorMessage = `Plugin instance ${instanceId} (${pluginConfig.id}) failed during ${hookName}: ${error.message}`;
        this.logger.error(errorMessage);
        // Plugin failures block the conversation flow
        throw new Error(errorMessage);
      }
    }

    return mergedResult;
  }
}
