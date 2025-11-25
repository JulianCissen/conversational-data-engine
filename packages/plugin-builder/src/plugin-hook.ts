/**
 * Context provided to plugins during execution.
 * Contains all necessary information about the current conversation state.
 */
export interface PluginContext {
  /**
   * The ID of the service blueprint being executed.
   */
  serviceId: string;

  /**
   * The unique identifier for the current conversation session.
   */
  conversationId: string;

  /**
   * Current collected data (slots) in the conversation.
   * Plugins can read from and write to this object.
   */
  data: Record<string, any>;

  /**
   * The ID of the field that was just validated (only set for onFieldValidated hook).
   */
  fieldId?: string;

  /**
   * The value that was just collected for the field (only set for onFieldValidated hook).
   */
  fieldValue?: any;

  /**
   * Plugin-specific configuration from the ServiceBlueprint.
   */
  config: Record<string, any>;
}

/**
 * Result returned by plugin hook execution.
 * Plugins can return slot updates to modify the conversation state.
 */
export interface PluginResult {
  /**
   * Optional updates to merge into the conversation data (slots).
   * These will be validated against the blueprint schema after merging.
   */
  slotUpdates?: Record<string, any>;

  /**
   * Optional metadata or logs for debugging purposes.
   */
  metadata?: Record<string, any>;
}

/**
 * Contract that all plugins must implement.
 * Plugins define their behavior by implementing these lifecycle hooks.
 */
export interface PluginHook {
  /**
   * Executed when a conversation service starts.
   * Use this to initialize data or perform authentication checks.
   * 
   * @param context - The plugin execution context
   * @returns Promise resolving to plugin result with optional slot updates
   */
  onStart?(context: PluginContext): Promise<PluginResult>;

  /**
   * Executed immediately after a field is successfully validated and stored.
   * Use this for data enrichment, external lookups, or pre-filling dependent fields.
   * 
   * @param context - The plugin execution context including fieldId and fieldValue
   * @returns Promise resolving to plugin result with optional slot updates
   */
  onFieldValidated?(context: PluginContext): Promise<PluginResult>;

  /**
   * Executed when the entire conversation flow is complete.
   * Use this to submit data to external systems, send notifications, or finalize the process.
   * 
   * @param context - The plugin execution context
   * @returns Promise resolving to plugin result
   */
  onConversationComplete?(context: PluginContext): Promise<PluginResult>;
}
