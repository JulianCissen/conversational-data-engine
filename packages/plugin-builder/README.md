# Plugin Builder for Conversational Data Engine

The `@conversational-data-engine/plugin-builder` package provides the core interfaces and utilities for building plugins that extend the Conversational Data Engine's functionality.

## Architecture Overview

The Conversational Data Engine uses a **drop-in plugin architecture** that allows external Node.js modules to hook into the conversation lifecycle. Plugins are registered via the Service Blueprint configuration and executed at specific points during the conversation flow.

### Plugin Lifecycle Hooks

Plugins can implement three lifecycle hooks:

1. **`onStart`**: Executed when a conversation service starts
   - Use case: Initialize data, perform authentication checks, prefill fields
   - Example: Fetch user profile data based on authenticated session

2. **`onFieldValidated`**: Executed immediately after a field is successfully validated
   - Use case: Data enrichment, external lookups, prefill dependent fields
   - Example: After collecting a postal code, lookup city and state

3. **`onConversationComplete`**: Executed when the entire conversation flow is complete
   - Use case: Submit data to external systems, send notifications, trigger workflows
   - Example: POST collected data to a CRM API

## Creating a Plugin

### Basic Structure

Every plugin must implement the `PluginHook` interface and return a `PluginResult` from each hook method.

```typescript
import { createPlugin, PluginContext, PluginResult } from '@conversational-data-engine/plugin-builder';

export const MyPlugin = createPlugin({
  async onStart(context: PluginContext): Promise<PluginResult> {
    // Initialize or prefill data
    return {
      slotUpdates: { initialized_at: new Date().toISOString() }
    };
  },

  async onFieldValidated(context: PluginContext): Promise<PluginResult> {
    // React to specific field validation
    if (context.fieldId === 'postal_code') {
      const locationData = await fetchLocation(context.fieldValue);
      return {
        slotUpdates: {
          city: locationData.city,
          state: locationData.state
        }
      };
    }
    return {};
  },

  async onConversationComplete(context: PluginContext): Promise<PluginResult> {
    // Submit final data
    await submitToAPI(context.data);
    return { metadata: { submitted: true } };
  }
});
```

### Plugin Context

The `PluginContext` object provides all necessary information about the current conversation state:

```typescript
interface PluginContext {
  serviceId: string;           // The ID of the service blueprint
  conversationId: string;       // Unique identifier for this conversation
  data: Record<string, any>;    // Current collected data (slots)
  fieldId?: string;             // ID of the field just validated (onFieldValidated only)
  fieldValue?: any;             // Value just collected (onFieldValidated only)
  config: Record<string, any>;  // Plugin-specific configuration from the blueprint
}
```

### Plugin Result

Plugins return a `PluginResult` that can optionally update conversation slots:

```typescript
interface PluginResult {
  slotUpdates?: Record<string, any>;  // Updates to merge into conversation data
  metadata?: Record<string, any>;     // Optional logs/debugging information
}
```

**Important**: Slot updates are validated against the blueprint schema after merging. If validation fails, the conversation flow will be blocked and an error will be raised.

## Registering Plugins

### Step 1: Create Plugin Manifest

Each plugin must have a `plugin.json` manifest file:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "entry": "dist/index.js"
}
```

### Step 2: Configure in Service Blueprint

Register plugins in your Service Blueprint and specify which hooks should execute them:

```json
{
  "id": "my-service",
  "name": "My Service",
  "fields": [...],
  "plugins": [
    {
      "id": "my-plugin",
      "config": {
        "apiKey": "secret-key",
        "endpoint": "https://api.example.com"
      }
    }
  ],
  "hooks": {
    "onStart": ["my-plugin"],
    "onFieldValidated": ["my-plugin"],
    "onConversationComplete": ["my-plugin"]
  }
}
```

### Step 3: Place Plugin in Plugins Directory

The backend will load plugins from a static directory (e.g., `packages/backend/plugins/`). Place your plugin folder containing the manifest and compiled code there.

## Error Handling

- **Plugin failures block the conversation flow**: If a plugin throws an error or returns invalid slot updates, the conversation will halt and the user will see an error message.
- **Validation always occurs after mutation**: Any slot updates returned by plugins are validated against the blueprint schema. Invalid updates will cause the flow to error.

## Best Practices

1. **Keep hooks focused**: Each hook should have a single responsibility
2. **Handle errors gracefully**: Throw descriptive errors that help debug issues
3. **Validate external data**: Don't trust external API responses blindly
4. **Use configuration**: Make plugins reusable by using the `config` object
5. **Document your plugin**: Include clear documentation on what config values are required

## Example: HTTP Caller Plugin

See `packages/plugins/http-caller` for a complete example of a plugin that makes HTTP requests and maps responses to conversation slots.

## TypeScript Support

This package is written in TypeScript and exports all necessary types. Use `createPlugin` for full type safety:

```typescript
import { createPlugin } from '@conversational-data-engine/plugin-builder';

export const MyPlugin = createPlugin({
  // TypeScript will enforce the PluginHook interface
  async onFieldValidated(context) {
    // context is fully typed
    return { slotUpdates: {} };
  }
});
```

## License

MIT
