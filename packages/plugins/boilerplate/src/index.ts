import {
  createPlugin,
  PluginContext,
  PluginResult,
} from '@conversational-data-engine/plugin-builder';

/**
 * Define your plugin's configuration interface here.
 * This will be used to type-check the configuration passed to your plugin.
 */
interface BoilerplateConfig {
  // Add your configuration properties here
  // Example:
  // apiKey?: string;
  // timeout?: number;
  exampleSetting?: string;
}

/**
 * Boilerplate Plugin
 * 
 * This is a minimal plugin implementation that demonstrates the basic structure
 * and lifecycle hooks available in the Conversational Data Engine plugin system.
 * 
 * Replace this implementation with your own logic to create a custom plugin.
 */
export const BoilerplatePlugin = createPlugin({
  /**
   * Called when a conversation/service starts.
   * Use this hook to initialize any resources or state needed for the conversation.
   * 
   * @param context - The plugin context containing service information
   * @returns PluginResult with optional slot updates or validation errors
   */
  async onStart(context: PluginContext): Promise<PluginResult> {
    const config = context.config as BoilerplateConfig;
    
    console.log('Boilerplate plugin started for service:', context.serviceId);
    console.log('Configuration:', config);
    
    // You can return slot updates or validation errors here
    // Example:
    // return {
    //   slotUpdates: {
    //     initialized: true
    //   }
    // };
    
    return {};
  },

  /**
   * Called when a field/slot has been validated.
   * Use this hook to perform additional validation, transformations, or side effects
   * based on the validated field value.
   * 
   * @param context - The plugin context containing field information and value
   * @returns PluginResult with optional slot updates or validation errors
   */
  async onFieldValidated(context: PluginContext): Promise<PluginResult> {
    const config = context.config as BoilerplateConfig;
    
    console.log('Field validated:', context.fieldId);
    console.log('Field value:', context.fieldValue);
    
    // You can perform additional validation or transformations here
    // Example: Update another slot based on this field's value
    // if (context.fieldId === 'email') {
    //   return {
    //     slotUpdates: {
    //       email_domain: context.fieldValue.split('@')[1]
    //     }
    //   };
    // }
    
    // Example: Return a validation error
    // if (context.fieldValue === 'invalid') {
    //   return {
    //     validationError: 'This value is not allowed'
    //   };
    // }
    
    return {};
  },

  /**
   * Called when a conversation is completed.
   * Use this hook to perform cleanup, send data to external systems,
   * or trigger post-conversation workflows.
   * 
   * @param context - The plugin context containing all conversation data
   * @returns PluginResult with optional slot updates or validation errors
   */
  async onConversationComplete(context: PluginContext): Promise<PluginResult> {
    const config = context.config as BoilerplateConfig;
    
    console.log('Conversation complete for service:', context.serviceId);
    console.log('Collected data:', context.data);
    
    // You can send data to external systems, perform cleanup, etc.
    // Example: Send data to an external API
    // try {
    //   await fetch('https://api.example.com/data', {
    //     method: 'POST',
    //     body: JSON.stringify(context.data)
    //   });
    // } catch (error) {
    //   console.error('Failed to send data:', error);
    // }
    
    return {};
  }
});

// Export as default for convenience
export default BoilerplatePlugin;
