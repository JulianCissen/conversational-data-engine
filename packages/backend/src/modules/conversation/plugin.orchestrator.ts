import { Injectable, Logger } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { PluginManagerService } from '../../core/plugin/plugin.service';

/**
 * PluginOrchestrator
 *
 * Centralizes all plugin hook execution logic.
 * Handles:
 * - onStart hooks
 * - onFieldValidated hooks
 * - onConversationComplete hooks
 * - Plugin configuration retrieval
 * - Slot update merging and validation
 */
@Injectable()
export class PluginOrchestrator {
  private readonly logger = new Logger(PluginOrchestrator.name);

  constructor(private readonly pluginManagerService: PluginManagerService) {}

  /**
   * Execute onStart hooks for a blueprint
   * Updates conversation data with plugin slot updates
   */
  public async executeOnStartHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<void> {
    if (!blueprint.hooks.onStart || blueprint.hooks.onStart.length === 0) {
      return;
    }

    this.logger.debug(
      `[${conversation.id}] Executing ${blueprint.hooks.onStart.length} onStart hook(s)`,
    );

    const pluginResult = await this.pluginManagerService.executeStart(
      blueprint.hooks.onStart,
      {
        serviceId: blueprint.id,
        conversationId: conversation.id,
        data: conversation.data,
        config: this.getPluginConfig(blueprint, blueprint.hooks.onStart[0]),
      },
      blueprint,
    );

    // Merge slot updates from plugins
    if (
      pluginResult.slotUpdates &&
      Object.keys(pluginResult.slotUpdates).length > 0
    ) {
      conversation.data = {
        ...conversation.data,
        ...pluginResult.slotUpdates,
      };

      this.logger.debug(
        `[${conversation.id}] Merged ${Object.keys(pluginResult.slotUpdates).length} slot update(s) from onStart hooks`,
      );
    }
  }

  /**
   * Execute onFieldValidated hooks for a specific field
   * Updates conversation data with plugin slot updates
   */
  public async executeOnFieldValidatedHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    fieldId: string,
    fieldValue: string | number | boolean | Date,
  ): Promise<void> {
    if (
      !blueprint.hooks.onFieldValidated ||
      blueprint.hooks.onFieldValidated.length === 0
    ) {
      return;
    }

    this.logger.debug(
      `[${conversation.id}] Executing onFieldValidated hook(s) for field: ${fieldId}`,
    );

    const pluginResult = await this.pluginManagerService.executeFieldValidated(
      blueprint.hooks.onFieldValidated,
      {
        serviceId: blueprint.id,
        conversationId: conversation.id,
        data: conversation.data,
        fieldId: fieldId,
        fieldValue: fieldValue,
        config: this.getPluginConfig(
          blueprint,
          blueprint.hooks.onFieldValidated[0],
        ),
      },
      blueprint,
    );

    // Merge slot updates from plugins
    if (
      pluginResult.slotUpdates &&
      Object.keys(pluginResult.slotUpdates).length > 0
    ) {
      conversation.data = {
        ...conversation.data,
        ...pluginResult.slotUpdates,
      };

      this.logger.debug(
        `[${conversation.id}] Merged ${Object.keys(pluginResult.slotUpdates).length} slot update(s) from onFieldValidated hooks`,
      );
    }
  }

  /**
   * Execute onConversationComplete hooks
   */
  public async executeOnConversationCompleteHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<void> {
    if (
      !blueprint.hooks.onConversationComplete ||
      blueprint.hooks.onConversationComplete.length === 0
    ) {
      return;
    }

    this.logger.debug(
      `[${conversation.id}] Executing ${blueprint.hooks.onConversationComplete.length} onConversationComplete hook(s)`,
    );

    await this.pluginManagerService.executeConversationComplete(
      blueprint.hooks.onConversationComplete,
      {
        serviceId: blueprint.id,
        conversationId: conversation.id,
        data: conversation.data,
        config: this.getPluginConfig(
          blueprint,
          blueprint.hooks.onConversationComplete[0],
        ),
      },
      blueprint,
    );
  }

  /**
   * Get plugin configuration for a specific plugin instance ID from the blueprint
   */
  private getPluginConfig(
    blueprint: ServiceBlueprint,
    instanceId: string,
  ): Record<string, any> {
    const plugin = blueprint.plugins.find(
      (p) => (p.instanceId || p.id) === instanceId,
    );
    return plugin?.config || {};
  }
}
