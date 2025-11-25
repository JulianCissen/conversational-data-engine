# Boilerplate Plugin

A minimal boilerplate plugin for the Conversational Data Engine. Use this as a starting point to create your own custom plugins.

## Getting Started

### 1. Clone or Copy This Boilerplate

If you're working within the monorepo:
```bash
cp -r packages/plugins/boilerplate packages/plugins/your-plugin-name
cd packages/plugins/your-plugin-name
```

If you're creating a standalone plugin:
```bash
# Clone the entire repo or just copy this boilerplate directory
git clone <repo-url>
cd packages/plugins/boilerplate
```

### 2. Customize the Plugin

#### Update `package.json`
- Change the `name` to `@conversational-data-engine/your-plugin-name`
- Update `description`, `author`, and other metadata
- If working outside the monorepo, change the plugin-builder dependency from `workspace:*` to a specific version

#### Update `plugin.json`
- Change `id` to a unique identifier (e.g., `your-plugin-name`)
- Update `name` and `description` to match your plugin's purpose

#### Implement Your Plugin Logic in `src/index.ts`
- Define your configuration interface (`BoilerplateConfig`)
- Implement the lifecycle hooks:
  - `onStart`: Initialize resources when a conversation starts
  - `onFieldValidated`: Handle field validation and transformations
  - `onConversationComplete`: Cleanup and post-conversation actions

### 3. Build the Plugin

```bash
npm install
npm run build
```

This will compile the TypeScript code to JavaScript in the `dist/` directory.

### 4. Deploy the Plugin

#### For Monorepo Development
The plugin is already in the correct location and will be picked up by the workspace.

#### For Backend Integration
Copy the plugin to the backend's plugins directory:
```bash
cp -r dist packages/backend/plugins/your-plugin-name/
cp plugin.json packages/backend/plugins/your-plugin-name/
```

### 5. Configure the Plugin in Your Service Blueprint

In your service blueprint JSON, add the plugin configuration:

```json
{
  "plugins": [
    {
      "id": "your-plugin-name",
      "config": {
        "exampleSetting": "value"
      }
    }
  ]
}
```

## Plugin Structure

```
boilerplate/
├── package.json          # NPM package configuration
├── tsconfig.json         # TypeScript compiler configuration
├── plugin.json           # Plugin manifest (metadata)
├── src/
│   └── index.ts         # Plugin implementation
└── dist/                # Compiled JavaScript (generated)
    ├── index.js
    └── index.d.ts
```

## Available Lifecycle Hooks

### `onStart(context: PluginContext): Promise<PluginResult>`
Called when a conversation/service starts. Use this to initialize resources.

### `onFieldValidated(context: PluginContext): Promise<PluginResult>`
Called after a field is validated. Use this to perform additional validation, transformations, or trigger side effects.

### `onConversationComplete(context: PluginContext): Promise<PluginResult>`
Called when a conversation completes. Use this for cleanup, data submission, or post-conversation workflows.

## PluginContext

The context object passed to each hook contains:

- `serviceId`: The ID of the service/blueprint
- `conversationId`: The ID of the current conversation
- `fieldId`: The ID of the field (for `onFieldValidated`)
- `fieldValue`: The value of the field (for `onFieldValidated`)
- `data`: All collected conversation data
- `config`: Plugin-specific configuration from the blueprint

## PluginResult

Return a `PluginResult` object with:

- `slotUpdates`: Object with key-value pairs to update conversation slots
- `validationError`: String message to indicate validation failure

Example:
```typescript
return {
  slotUpdates: {
    computed_field: 'calculated_value'
  },
  validationError: 'Invalid input provided'
};
```

## Examples

See the `http-caller` plugin for a real-world example of a plugin that makes HTTP requests.

## Development Tips

- Use TypeScript for type safety and better IDE support
- Test your plugin locally before deploying
- Log important events for debugging
- Handle errors gracefully
- Keep plugins focused on a single responsibility

## License

ISC
