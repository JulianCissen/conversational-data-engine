import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PluginContext, PluginResult, PluginHook } from '@conversational-data-engine/plugin-builder';
import { PluginConfig, loadAndValidatePluginConfig } from './plugin.config';
import { ServiceBlueprint, PluginConfig as BlueprintPluginConfig } from '../../modules/blueprint/interfaces/blueprint.interface';
import { z } from 'zod';
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
 * Zod schema for validating plugin manifest (plugin.json) structure.
 */
const PluginMetadataSchema = z.object({
  id: z.string().min(1, 'Plugin id is required'),
  name: z.string().min(1, 'Plugin name is required'),
  version: z.string().min(1, 'Plugin version is required'),
  entry: z.string().min(1, 'Plugin entry file is required'),
});

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
    const directoryAccessible = await this.checkPluginDirectoryAccessible();
    if (!directoryAccessible) return;

    const pluginDirs = await this.getPluginDirectories();
    for (const dir of pluginDirs) {
      await this.loadPlugin(dir);
    }

    this.logger.log(`Loaded ${this.plugins.size} plugin(s)`);
  }

  /**
   * Check if the plugins directory is accessible.
   * @returns True if accessible, false otherwise
   */
  private async checkPluginDirectoryAccessible(): Promise<boolean> {
    try {
      await fs.promises.access(this.config.pluginsDirectory);
      return true;
    } catch (error) {
      this.logger.warn(
        `Plugins directory is not accessible: ${this.config.pluginsDirectory}. Plugins will be disabled.`,
      );
      return false;
    }
  }

  /**
   * Get all plugin directories within the configured plugins directory.
   * @returns Array of plugin directory paths
   */
  private async getPluginDirectories(): Promise<string[]> {
    const entries = await fs.promises.readdir(this.config.pluginsDirectory, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(this.config.pluginsDirectory, entry.name));
  }

  /**
   * Check if a file exists and is accessible.
   * @param filePath Path to the file to check
   * @param errorMessage Custom error message to log if file is not accessible
   * @returns True if file exists and is accessible, false otherwise
   */
  private async checkFileExists(
    filePath: string,
    errorMessage: string,
  ): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch (error) {
      this.logger.warn(errorMessage);
      return false;
    }
  }

  /**
   * Load and validate the plugin manifest file.
   * @param manifestPath Path to the plugin.json file
   * @returns Parsed manifest metadata or null if invalid
   */
  private async loadPluginManifest(
    manifestPath: string,
  ): Promise<PluginMetadata | null> {
    try {
      const manifestContent = await fs.promises.readFile(
        manifestPath,
        'utf-8',
      );
      const manifestJson = JSON.parse(manifestContent);
      
      // Validate with Zod schema
      const manifest = PluginMetadataSchema.parse(manifestJson);
      return manifest;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn(
          `Invalid manifest at ${manifestPath}: ${error.issues.map(e => e.message).join(', ')}`,
        );
      } else {
        this.logger.warn(
          `Failed to parse manifest at ${manifestPath}: ${error.message}`,
        );
      }
      return null;
    }
  }

  /**
   * Import a plugin module from the entry file path.
   * Handles dynamic import with proper file:// URL conversion for Windows compatibility.
   * @param entryPath Absolute path to the plugin entry file
   * @returns Plugin instance or null if import fails
   */
  private async importPluginModule(entryPath: string): Promise<PluginHook | null> {
    try {
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

      return pluginInstance;
    } catch (error) {
      this.logger.error(
        `Failed to import plugin module from ${entryPath}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Load a single plugin from a directory.
   * Expects a plugin.json manifest and the specified entry file.
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Check manifest file exists
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestExists = await this.checkFileExists(
        manifestPath,
        `Skipping plugin: No plugin.json found in ${pluginPath}`,
      );
      if (!manifestExists) return;

      // Load and validate manifest
      const manifest = await this.loadPluginManifest(manifestPath);
      if (!manifest) return;

      // Check entry file exists
      const entryPath = path.join(pluginPath, manifest.entry);
      const entryExists = await this.checkFileExists(
        entryPath,
        `Skipping plugin ${manifest.id}: Entry file not found at ${entryPath}`,
      );
      if (!entryExists) return;

      // Import plugin module
      const pluginInstance = await this.importPluginModule(entryPath);
      if (!pluginInstance) return;

      // Register plugin
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
    blueprint: ServiceBlueprint,
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
    blueprint: ServiceBlueprint,
  ): Promise<PluginResult> {
    // Filter plugins based on triggerOnField configuration
    const filteredInstanceIds = pluginInstanceIds.filter((instanceId) => {
      const pluginConfig = blueprint.plugins.find(
        (p) => (p.instanceId || p.id) === instanceId,
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
    blueprint: ServiceBlueprint,
  ): Promise<PluginResult> {
    return this.executeHook('onConversationComplete', pluginInstanceIds, context, blueprint);
  }

  /**
   * Get a plugin instance by its instance ID from the blueprint.
   * @param instanceId The instance ID to look up
   * @param blueprint The service blueprint containing plugin configurations
   * @returns Object containing plugin config and loaded plugin, or null if not found
   */
  private getPluginInstance(
    instanceId: string,
    blueprint: ServiceBlueprint,
  ): { config: BlueprintPluginConfig; plugin: LoadedPlugin } | null {
    // Find the plugin config by instanceId or id
    const pluginConfig = blueprint.plugins.find(
      (p) => (p.instanceId || p.id) === instanceId,
    );

    if (!pluginConfig) {
      this.logger.error(`Plugin instance not found in blueprint: ${instanceId}`);
      return null;
    }

    // Get the actual plugin by its type id
    const plugin = this.plugins.get(pluginConfig.id);

    if (!plugin) {
      this.logger.error(`Plugin type not found: ${pluginConfig.id}`);
      return null;
    }

    return { config: pluginConfig, plugin };
  }

  /**
   * Execute a specific hook on a single plugin instance.
   * @param hookName The name of the hook to execute
   * @param instanceId The plugin instance ID
   * @param pluginConfig The plugin configuration from blueprint
   * @param plugin The loaded plugin instance
   * @param context The plugin execution context
   * @returns Plugin result or null if hook doesn't exist
   */
  private async executePluginHook(
    hookName: string,
    instanceId: string,
    pluginConfig: BlueprintPluginConfig,
    plugin: LoadedPlugin,
    context: PluginContext,
  ): Promise<PluginResult | null> {
    const hookFn = plugin.instance[hookName];

    if (typeof hookFn !== 'function') {
      this.logger.debug(
        `Plugin instance ${instanceId} (${pluginConfig.id}) does not implement ${hookName}, skipping`,
      );
      return null;
    }

    this.logger.debug(
      `Executing ${hookName} for plugin instance: ${instanceId} (${pluginConfig.id})`,
    );

    const result: PluginResult = await hookFn.call(plugin.instance, context);
    return result;
  }

  /**
   * Generic method to execute a specific hook across multiple plugins.
   * Collects and merges slot updates from all plugins.
   */
  private async executeHook(
    hookName: string,
    pluginInstanceIds: string[],
    context: PluginContext,
    blueprint: ServiceBlueprint,
  ): Promise<PluginResult> {
    const mergedResult: PluginResult = {
      slotUpdates: {},
      metadata: {},
    };

    for (const instanceId of pluginInstanceIds) {
      // Get plugin instance and config
      const pluginData = this.getPluginInstance(instanceId, blueprint);
      if (!pluginData) {
        throw new Error(`Failed to retrieve plugin instance: ${instanceId}`);
      }

      const { config: pluginConfig, plugin } = pluginData;

      try {
        // Execute the hook
        const result = await this.executePluginHook(
          hookName,
          instanceId,
          pluginConfig,
          plugin,
          context,
        );

        // Skip if hook not implemented
        if (!result) continue;

        // Merge slot updates
        if (result.slotUpdates) {
          mergedResult.slotUpdates = {
            ...mergedResult.slotUpdates,
            ...result.slotUpdates,
          };
        }

        // Collect metadata
        if (result.metadata) {
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
