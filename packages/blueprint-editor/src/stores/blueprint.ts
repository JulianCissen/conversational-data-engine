import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  ServiceBlueprint,
  FieldDefinition,
  PluginConfig,
  ServiceHooks,
  LanguageConfig,
} from '@conversational-data-engine/types';
import { ServiceBlueprintSchema } from '@conversational-data-engine/types';
import type { ZodError } from 'zod';

export const useBlueprintStore = defineStore('blueprint', () => {
  // State
  const id = ref('');
  const name = ref('');
  const languageConfig = ref<LanguageConfig | undefined>(undefined);
  const fields = ref<FieldDefinition[]>([]);
  const plugins = ref<PluginConfig[]>([]);
  const hooks = ref<ServiceHooks>({
    onStart: [],
    onFieldValidated: [],
    onConversationComplete: [],
  });

  // Validation state
  const validationErrors = ref<ZodError | null>(null);

  // Computed: Generate JSON from current state
  const blueprintJSON = computed((): ServiceBlueprint => {
    return {
      id: id.value,
      name: name.value,
      languageConfig: languageConfig.value,
      fields: fields.value,
      plugins: plugins.value,
      hooks: hooks.value,
    };
  });

  // Computed: Formatted JSON string
  const blueprintJSONString = computed((): string => {
    return JSON.stringify(blueprintJSON.value, null, 2);
  });

  // Computed: Is blueprint valid
  const isValid = computed((): boolean => {
    const result = ServiceBlueprintSchema.safeParse(blueprintJSON.value);
    validationErrors.value = result.success ? null : result.error;
    return result.success;
  });

  // Actions: Service Metadata
  function updateMetadata(updates: { id?: string; name?: string; languageConfig?: LanguageConfig }) {
    if (updates.id !== undefined) id.value = updates.id;
    if (updates.name !== undefined) name.value = updates.name;
    if (updates.languageConfig !== undefined) languageConfig.value = updates.languageConfig;
  }

  // Actions: Fields
  function addField(field: FieldDefinition) {
    fields.value.push(field);
  }

  function updateField(index: number, field: FieldDefinition) {
    if (index >= 0 && index < fields.value.length) {
      fields.value[index] = field;
    }
  }

  function deleteField(index: number) {
    if (index >= 0 && index < fields.value.length) {
      fields.value.splice(index, 1);
    }
  }

  function reorderFields(oldIndex: number, newIndex: number) {
    if (oldIndex >= 0 && oldIndex < fields.value.length && newIndex >= 0 && newIndex < fields.value.length) {
      const [removed] = fields.value.splice(oldIndex, 1);
      if (removed) {
        fields.value.splice(newIndex, 0, removed);
      }
    }
  }

  function duplicateField(index: number) {
    if (index >= 0 && index < fields.value.length) {
      const original = fields.value[index]!;
      const field: FieldDefinition = {
        id: `${original.id}_copy`,
        type: original.type,
        questionTemplate: original.questionTemplate,
        aiContext: original.aiContext,
        validation: { ...original.validation },
        condition: original.condition,
        verbatim: original.verbatim,
      };
      fields.value.splice(index + 1, 0, field);
    }
  }

  // Actions: Plugins
  function addPlugin(plugin: PluginConfig) {
    plugins.value.push(plugin);
  }

  function updatePlugin(index: number, plugin: PluginConfig) {
    if (index >= 0 && index < plugins.value.length) {
      plugins.value[index] = plugin;
    }
  }

  function deletePlugin(index: number) {
    if (index >= 0 && index < plugins.value.length) {
      plugins.value.splice(index, 1);
    }
  }

  // Actions: Hooks
  function updateHooks(newHooks: ServiceHooks) {
    hooks.value = newHooks;
  }

  // Actions: Import/Export
  function importBlueprint(json: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(json);
      const result = ServiceBlueprintSchema.safeParse(parsed);
      
      if (!result.success) {
        return {
          success: false,
          error: `Validation failed: ${result.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        };
      }

      const blueprint = result.data;
      id.value = blueprint.id;
      name.value = blueprint.name;
      languageConfig.value = blueprint.languageConfig;
      fields.value = blueprint.fields;
      plugins.value = blueprint.plugins;
      hooks.value = blueprint.hooks;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  function exportBlueprint(): Blob {
    const json = blueprintJSONString.value;
    return new Blob([json], { type: 'application/json' });
  }

  function clearAll() {
    id.value = '';
    name.value = '';
    languageConfig.value = undefined;
    fields.value = [];
    plugins.value = [];
    hooks.value = {
      onStart: [],
      onFieldValidated: [],
      onConversationComplete: [],
    };
    validationErrors.value = null;
  }

  // Actions: Templates
  function loadTemplate(templateName: string) {
    if (templateName === 'empty') {
      clearAll();
    } else if (templateName === 'travel-expense') {
      clearAll();
      id.value = 'travel_expense';
      name.value = 'Travel Expense Reimbursement';
      languageConfig.value = {
        mode: 'adaptive',
        defaultLanguage: 'en-US',
      };
      fields.value = [
        {
          id: 'trip_purpose',
          type: 'string',
          questionTemplate: 'What was the purpose of your trip?',
          aiContext: 'We need to understand why the employee traveled for compliance and budgeting.',
          validation: { type: 'string', minLength: 10 },
        },
        {
          id: 'trip_date',
          type: 'date',
          questionTemplate: 'When did you travel?',
          aiContext: 'The date of travel is required for expense tracking.',
          validation: { type: 'string', format: 'date' },
        },
        {
          id: 'amount',
          type: 'number',
          questionTemplate: 'What was the total expense amount?',
          aiContext: 'Total reimbursement amount requested.',
          validation: { type: 'number', minimum: 0 },
        },
      ];
    }
  }

  return {
    // State
    id,
    name,
    languageConfig,
    fields,
    plugins,
    hooks,
    validationErrors,
    // Computed
    blueprintJSON,
    blueprintJSONString,
    isValid,
    // Actions
    updateMetadata,
    addField,
    updateField,
    deleteField,
    reorderFields,
    duplicateField,
    addPlugin,
    updatePlugin,
    deletePlugin,
    updateHooks,
    importBlueprint,
    exportBlueprint,
    clearAll,
    loadTemplate,
  };
});
