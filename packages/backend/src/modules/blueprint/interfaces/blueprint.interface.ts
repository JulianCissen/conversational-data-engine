import { RulesLogic } from 'json-logic-js';

/**
 * Type alias for JSON Schema validation objects.
 * Will be replaced with a more specific type in the future.
 */
export type JsonSchema = Record<string, any>;

/**
 * Supported scalar field types in the Service Blueprint.
 * Arrays and complex types are not yet supported.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date';

/**
 * Defines a single field in the conversational flow.
 */
export interface FieldDefinition {
  /**
   * Unique identifier for this field (e.g., "user_age", "transport_type").
   */
  id: string;

  /**
   * The scalar data type this field should collect.
   */
  type: FieldType;

  /**
   * Template string that the AI uses to ask the user for this information.
   */
  questionTemplate: string;

  /**
   * Contextual explanation for the AI about why this field is needed
   * and how it should be collected.
   */
  aiContext: string;

  /**
   * JSON Schema object defining validation rules for this field.
   */
  validation: JsonSchema;

  /**
   * Optional JsonLogic condition that determines if this field should be shown.
   * If the condition evaluates to true (or is undefined), the field is visible.
   * If false, the field is skipped.
   */
  condition?: RulesLogic;
}

/**
 * Configuration for a plugin that extends service functionality.
 */
export interface PluginConfig {
  /**
   * Unique identifier for the plugin type (e.g., "http-caller", "user-lookup").
   */
  id: string;

  /**
   * Optional instance identifier for this specific plugin configuration.
   * Allows the same plugin to be used multiple times with different configs.
   * If not provided, defaults to the plugin id.
   */
  instanceId?: string;

  /**
   * Optional field ID to filter execution for onFieldValidated hooks.
   * If set, the plugin will only execute when this specific field is validated.
   */
  triggerOnField?: string;

  /**
   * Plugin-specific configuration object.
   */
  config: Record<string, any>;
}

/**
 * Hooks that define when plugins are executed during the service lifecycle.
 */
export interface ServiceHooks {
  /**
   * Array of plugin instance IDs to execute when the service starts.
   * References the instanceId (or id if instanceId not provided) from PluginConfig.
   */
  onStart?: string[];

  /**
   * Array of plugin instance IDs to execute immediately after a field is successfully validated and stored.
   * This is designed for intermediate data lookups (e.g., pre-filling data).
   * Plugins can also use triggerOnField to filter which fields they respond to.
   */
  onFieldValidated?: string[];

  /**
   * Array of plugin instance IDs to execute when the conversation is complete.
   * References the instanceId (or id if instanceId not provided) from PluginConfig.
   */
  onConversationComplete?: string[];
}

/**
 * Complete definition of a conversational service.
 * This Blueprint drives the deterministic State Machine.
 */
export interface ServiceBlueprint {
  /**
   * Unique identifier for this service (e.g., "travel_expense").
   */
  id: string;

  /**
   * Human-readable name for this service.
   */
  name: string;

  /**
   * Ordered array of fields to collect during the conversation.
   */
  fields: FieldDefinition[];

  /**
   * Array of available plugins for this service.
   */
  plugins: PluginConfig[];

  /**
   * Lifecycle hooks defining when plugins should execute.
   */
  hooks: ServiceHooks;
}
