import { PluginHook } from './plugin-hook';

/**
 * Factory function to create a plugin that conforms to the PluginHook interface.
 * This helper enforces the contract and provides type safety for plugin authors.
 * 
 * @param plugin - An object implementing the PluginHook interface
 * @returns The same plugin object, typed as PluginHook
 * 
 * @example
 * ```typescript
 * import { createPlugin, PluginContext, PluginResult } from '@conversational-data-engine/plugin-builder';
 * 
 * export const MyPlugin = createPlugin({
 *   async onStart(context: PluginContext): Promise<PluginResult> {
 *     console.log('Service started:', context.serviceId);
 *     return { slotUpdates: { initialized: true } };
 *   },
 * 
 *   async onFieldValidated(context: PluginContext): Promise<PluginResult> {
 *     if (context.fieldId === 'user_id') {
 *       const userData = await fetchUserData(context.fieldValue);
 *       return { slotUpdates: { user_name: userData.name } };
 *     }
 *     return {};
 *   },
 * 
 *   async onConversationComplete(context: PluginContext): Promise<PluginResult> {
 *     await submitToAPI(context.data);
 *     return { metadata: { submitted: true } };
 *   }
 * });
 * ```
 */
export function createPlugin(plugin: PluginHook): PluginHook {
  return plugin;
}
