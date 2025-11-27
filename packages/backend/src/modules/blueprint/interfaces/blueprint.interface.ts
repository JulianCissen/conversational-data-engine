import { z } from 'zod';

/**
 * Type alias for JSON Schema validation objects.
 * Will be replaced with a more specific type in the future.
 */
export type JsonSchema = Record<string, any>;

export const LanguageConfigSchema = z.object({
  mode: z.enum(['adaptive', 'strict']),
  defaultLanguage: z.string(),
});

/**
 * Configuration for language handling in the service.
 *
 * @property mode - The language enforcement mode:
 *   - 'adaptive': AI adapts to the user's language automatically
 *   - 'strict': Enforces communication in a specific language only
 * @property defaultLanguage - The default/required language as an ISO language code (e.g., 'en-US', 'de-DE', 'fr-FR').
 *   - In 'strict' mode: This language is enforced for all communication.
 *   - In 'adaptive' mode: This acts as the fallback/default language.
 */
export type LanguageConfig = z.infer<typeof LanguageConfigSchema>;

/**
 * Supported scalar field types in the Service Blueprint.
 * Arrays and complex types are not yet supported.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date';

export const FieldDefinitionSchema = z.object({
  id: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'date']),
  questionTemplate: z.string(),
  aiContext: z.string(),
  validation: z.record(z.string(), z.any()),
  condition: z.any().optional(),
  verbatim: z.boolean().optional(),
});

/**
 * Defines a single field in the conversational flow.
 *
 * @property id - Unique identifier for this field (e.g., "user_age", "transport_type").
 * @property type - The scalar data type this field should collect.
 * @property questionTemplate - Template string that the AI uses to ask the user for this information.
 * @property aiContext - Contextual explanation for the AI about why this field is needed and how it should be collected.
 * @property validation - JSON Schema object defining validation rules for this field.
 * @property condition - Optional JsonLogic condition that determines if this field should be shown.
 *   If the condition evaluates to true (or is undefined), the field is visible. If false, the field is skipped.
 * @property verbatim - If true, the question must be asked exactly as written in questionTemplate.
 *   The AI can still generate conversational context, but the final question must match the blueprint text verbatim
 *   (important for legal/judicial compliance).
 */
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

export const PluginConfigSchema = z.object({
  id: z.string(),
  instanceId: z.string().optional(),
  triggerOnField: z.string().optional(),
  config: z.record(z.string(), z.any()),
});

/**
 * Configuration for a plugin that extends service functionality.
 *
 * @property id - Unique identifier for the plugin type (e.g., "http-caller", "user-lookup").
 * @property instanceId - Optional instance identifier for this specific plugin configuration.
 *   Allows the same plugin to be used multiple times with different configs. If not provided, defaults to the plugin id.
 * @property triggerOnField - Optional field ID to filter execution for onFieldValidated hooks.
 *   If set, the plugin will only execute when this specific field is validated.
 * @property config - Plugin-specific configuration object.
 */
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

export const ServiceHooksSchema = z.object({
  onStart: z.array(z.string()).optional(),
  onFieldValidated: z.array(z.string()).optional(),
  onConversationComplete: z.array(z.string()).optional(),
});

/**
 * Hooks that define when plugins are executed during the service lifecycle.
 *
 * @property onStart - Array of plugin instance IDs to execute when the service starts.
 *   References the instanceId (or id if instanceId not provided) from PluginConfig.
 * @property onFieldValidated - Array of plugin instance IDs to execute immediately after a field is successfully
 *   validated and stored. This is designed for intermediate data lookups (e.g., pre-filling data).
 *   Plugins can also use triggerOnField to filter which fields they respond to.
 * @property onConversationComplete - Array of plugin instance IDs to execute when the conversation is complete.
 *   References the instanceId (or id if instanceId not provided) from PluginConfig.
 */
export type ServiceHooks = z.infer<typeof ServiceHooksSchema>;

export const ServiceBlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  languageConfig: LanguageConfigSchema.optional(),
  fields: z.array(FieldDefinitionSchema),
  plugins: z.array(PluginConfigSchema),
  hooks: ServiceHooksSchema,
});

/**
 * Complete definition of a conversational service.
 * This Blueprint drives the deterministic State Machine.
 *
 * @property id - Unique identifier for this service (e.g., "travel_expense").
 * @property name - Human-readable name for this service.
 * @property languageConfig - Optional language configuration for this service.
 *   If not provided, defaults to adaptive mode with 'en-US' as default language.
 * @property fields - Ordered array of fields to collect during the conversation.
 * @property plugins - Array of available plugins for this service.
 * @property hooks - Lifecycle hooks defining when plugins should execute.
 */
export type ServiceBlueprint = z.infer<typeof ServiceBlueprintSchema>;
