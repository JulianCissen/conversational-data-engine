# Plugin System Implementation Guide

This guide documents the plugin system implementation for the Conversational Data Engine (Story 13).

## Overview

The plugin system allows external Node.js modules to extend the conversation flow at specific lifecycle hooks. Plugins are:

- **Drop-in**: Loaded from a static directory at runtime
- **Hook-based**: Execute at defined points (onStart, onFieldValidated, onConversationComplete)
- **Configuration-driven**: Registered via Service Blueprint JSON files
- **Type-safe**: Built with TypeScript using the `@conversational-data-engine/plugin-builder` package

## Architecture

### Components

1. **`packages/plugin-builder`**: Shared library defining plugin interfaces and helpers
2. **`packages/backend/src/core/plugin`**: Plugin manager service that loads and executes plugins
3. **`packages/plugins/*`**: Individual plugin implementations
4. **Service Blueprints**: JSON configurations that register plugins and define hooks

## Setup Instructions

### 1. Install Dependencies

```bash
# Navigate to plugin-builder
cd packages/plugin-builder
npm install
npm run build

# Navigate to http-caller plugin
cd ../plugins/http-caller
npm install
npm run build

# Navigate to backend
cd ../../backend
npm install
```

### 2. Deploy the HTTP Caller Plugin

Create the plugins directory and deploy the plugin:

```bash
# From project root
mkdir -p packages/backend/plugins/http-caller
cp packages/plugins/http-caller/plugin.json packages/backend/plugins/http-caller/
cp -r packages/plugins/http-caller/dist packages/backend/plugins/http-caller/
```

### 3. Configure Backend Environment

Create or update `packages/backend/.env`:

```env
# Plugin Configuration
PLUGINS_DIRECTORY=./plugins

# Other existing configuration...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/conversational_db
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
```

### 4. Test with Sample Blueprint

The `user-registration.json` blueprint demonstrates plugin usage:

```bash
# Start the backend
cd packages/backend
npm run start:dev
```

The `user_registration` service will:
1. Ask for `user_id`
2. Execute the `http-caller` plugin (via `onFieldValidated` hook)
3. Fetch user data from JSONPlaceholder API
4. Pre-fill `user_name` and `user_email` fields
5. Continue the conversation flow

## Plugin Lifecycle Hooks

### onStart
Executed when a conversation service starts.

**Use cases:**
- Initialize session data
- Perform authentication checks
- Prefill fields with known data

**Example:**
```json
{
  "hooks": {
    "onStart": ["auth-validator", "session-initializer"]
  }
}
```

### onFieldValidated
Executed immediately after a field is successfully validated and stored.

**Use cases:**
- Data enrichment from external APIs
- Pre-filling dependent fields
- Real-time validation against external systems

**Example:**
```json
{
  "hooks": {
    "onFieldValidated": ["http-caller", "address-validator"]
  }
}
```

### onConversationComplete
Executed when the entire conversation flow is complete.

**Use cases:**
- Submit data to external systems
- Send notifications
- Trigger downstream workflows

**Example:**
```json
{
  "hooks": {
    "onConversationComplete": ["crm-submit", "email-notifier"]
  }
}
```

## Creating Custom Plugins

### 1. Create Plugin Package

```bash
mkdir -p packages/plugins/my-plugin
cd packages/plugins/my-plugin
npm init -y
```

### 2. Install Dependencies

```json
{
  "dependencies": {
    "@conversational-data-engine/plugin-builder": "file:../../plugin-builder"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.5"
  }
}
```

### 3. Implement Plugin

Create `src/index.ts`:

```typescript
import { createPlugin, PluginContext, PluginResult } from '@conversational-data-engine/plugin-builder';

export const MyPlugin = createPlugin({
  async onStart(context: PluginContext): Promise<PluginResult> {
    console.log('Service started:', context.serviceId);
    return {
      slotUpdates: { initialized_at: new Date().toISOString() }
    };
  },

  async onFieldValidated(context: PluginContext): Promise<PluginResult> {
    if (context.fieldId === 'postal_code') {
      // Fetch location data
      const locationData = await fetchLocationData(context.fieldValue);
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
    await submitToAPI(context.data);
    return { metadata: { submitted: true } };
  }
});

export default MyPlugin;
```

### 4. Create Manifest

Create `plugin.json`:

```json
{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Custom plugin for data processing",
  "entry": "dist/index.js"
}
```

### 5. Build and Deploy

```bash
npm run build
mkdir -p ../../backend/plugins/my-plugin
cp plugin.json ../../backend/plugins/my-plugin/
cp -r dist ../../backend/plugins/my-plugin/
```

### 6. Register in Blueprint

```json
{
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
    "onFieldValidated": ["my-plugin"]
  }
}
```

## Error Handling

- **Plugin failures block the conversation flow** by default
- Errors include detailed messages for debugging
- Slot updates are validated against the blueprint schema after merging
- Invalid slot updates cause the flow to error

## Validation Rules

When plugins return `slotUpdates`:

1. Updates are merged into the conversation data
2. Each updated field is validated against its field definition in the blueprint
3. If validation fails, the conversation flow is blocked with an error
4. Only fields defined in the blueprint can be updated

## File Structure

```
packages/
├── plugin-builder/           # Shared plugin interface library
│   ├── src/
│   │   ├── plugin-hook.ts   # PluginHook interface
│   │   ├── plugin-builder.ts # createPlugin helper
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── plugins/                  # Individual plugin implementations
│   └── http-caller/
│       ├── src/
│       │   └── index.ts
│       ├── plugin.json       # Plugin manifest
│       ├── package.json
│       └── tsconfig.json
└── backend/
    ├── src/
    │   ├── core/
    │   │   └── plugin/       # Plugin manager
    │   │       ├── plugin.module.ts
    │   │       └── plugin.service.ts
    │   └── modules/
    │       ├── blueprint/
    │       │   ├── interfaces/
    │       │   │   └── blueprint.interface.ts  # Updated with onFieldValidated
    │       │   └── data/
    │       │       └── user-registration.json  # Example blueprint
    │       └── conversation/
    │           └── conversation.service.ts      # Integrated with PluginManager
    └── plugins/              # Deployed plugins (gitignored)
        └── http-caller/
            ├── plugin.json
            └── dist/
```

## Testing

### Manual Testing

1. Start the backend: `npm run start:dev`
2. Use the frontend or API client to start a conversation
3. Select the "User Registration with Data Enrichment" service
4. Provide a user ID (e.g., "1" for JSONPlaceholder API)
5. Observe that `user_name` and `user_email` are pre-filled

### Plugin Testing

Create a test script for your plugin:

```typescript
import { MyPlugin } from './src/index';

const context = {
  serviceId: 'test',
  conversationId: 'test-123',
  data: { field1: 'value1' },
  fieldId: 'field1',
  fieldValue: 'value1',
  config: { /* plugin config */ }
};

MyPlugin.onFieldValidated!(context)
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

Run: `npx ts-node test.ts`

## Troubleshooting

### Plugin Not Loading

Check the backend logs for plugin loading messages:
```
[PluginManagerService] Loading plugins from: /path/to/plugins
[PluginManagerService] Loaded plugin: HTTP Caller Plugin (http-caller) v1.0.0
```

If the plugin isn't loaded:
- Verify `PLUGINS_DIRECTORY` environment variable
- Check that `plugin.json` exists and is valid
- Ensure the `entry` file exists at the specified path
- Check file permissions

### Plugin Execution Errors

Errors will appear in the conversation response:
```json
{
  "error": "Plugin http-caller failed during onFieldValidated: HTTP 404: Not Found"
}
```

Debug by:
- Checking plugin configuration in the blueprint
- Verifying API endpoints and credentials
- Testing the plugin independently
- Reviewing backend logs for detailed stack traces

### Slot Update Validation Failures

If slot updates fail validation:
```
Error: Plugin slot update validation failed for field: user_email
```

Ensure:
- The field exists in the blueprint
- The value matches the field's JSON Schema validation
- The data type is correct

## Future Enhancements

Potential improvements for the plugin system:

1. **Hot Reloading**: Reload plugins without restarting the backend
2. **Plugin Marketplace**: NPM registry for community plugins
3. **Async Hooks**: Non-blocking plugin execution for optional features
4. **Plugin Dependencies**: Allow plugins to depend on other plugins
5. **Conditional Execution**: Execute plugins based on field values or conditions
6. **Rate Limiting**: Built-in rate limiting for external API calls
7. **Caching**: Cache plugin responses to reduce API calls
8. **Monitoring**: Metrics and observability for plugin performance

## Security Considerations

- **Validate all external data**: Don't trust API responses blindly
- **Use environment variables**: Store API keys in `.env`, never in code
- **Implement timeouts**: Prevent hanging requests from blocking the flow
- **Sanitize inputs**: Validate slot values before interpolating into URLs
- **Audit third-party plugins**: Review code before deploying to production
- **Implement RBAC**: Control which services can use which plugins

## License

UNLICENSED
