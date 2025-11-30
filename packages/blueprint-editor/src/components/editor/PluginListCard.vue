<template>
  <v-card :elevation="0" variant="outlined" class="plugin-list-card">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <v-icon class="mr-2">mdi-puzzle-outline</v-icon>
        Plugins
        <v-chip size="small" class="ml-2">{{ blueprintStore.plugins.length }}</v-chip>
      </div>
      <v-btn
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openPluginDialog()"
      >
        Add plugin
      </v-btn>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <v-list v-if="blueprintStore.plugins.length > 0">
        <v-list-item
          v-for="(plugin, index) in blueprintStore.plugins"
          :key="plugin.id + (plugin.instanceId || '')"
          class="plugin-item"
        >
          <v-list-item-title>
            <strong>{{ plugin.id }}</strong>
            <v-chip v-if="plugin.instanceId" size="x-small" class="ml-2">
              Instance: {{ plugin.instanceId }}
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle>
            <span v-if="plugin.triggerOnField">Triggers on: {{ plugin.triggerOnField }}</span>
            <span v-else>No trigger field</span>
          </v-list-item-subtitle>

          <template #append>
            <v-btn icon="mdi-pencil" size="small" variant="text" @click="openPluginDialog(index)" />
            <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="deletePlugin(index)" />
          </template>
        </v-list-item>
      </v-list>

      <v-alert v-else type="info" variant="tonal">
        No plugins configured. Click "Add Plugin" to integrate external functionality.
      </v-alert>
    </v-card-text>

    <!-- Plugin Editor Dialog -->
    <v-dialog v-model="pluginDialog" max-width="800" scrollable>
      <v-card>
        <v-card-title>{{ editingIndex === null ? 'Add' : 'Edit' }} Plugin</v-card-title>
        <v-divider />
        <v-card-text>
          <v-text-field
            v-model="editingPlugin.id"
            label="Plugin ID *"
            hint="e.g., 'http-caller', 'user-lookup'"
            persistent-hint
            variant="outlined"
            density="comfortable"
            class="mb-4"
          />

          <v-text-field
            v-model="editingPlugin.instanceId"
            label="Instance ID (optional)"
            hint="Unique identifier for this plugin instance"
            persistent-hint
            variant="outlined"
            density="comfortable"
            class="mb-4"
          />

          <v-autocomplete
            v-model="editingPlugin.triggerOnField"
            label="Trigger On Field (optional)"
            hint="Field ID to trigger this plugin"
            persistent-hint
            :items="availableFieldIds"
            variant="outlined"
            density="comfortable"
            clearable
            class="mb-4"
          />

          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">Plugin Configuration (JSON)</div>
          <v-textarea
            v-model="configJSON"
            label="Config (JSON)"
            hint="Plugin-specific configuration object"
            persistent-hint
            variant="outlined"
            rows="8"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pluginDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" @click="savePlugin">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBlueprintStore } from '../../stores/blueprint';
import type { PluginConfig } from '@conversational-data-engine/types';

const blueprintStore = useBlueprintStore();

const pluginDialog = ref(false);
const editingIndex = ref<number | null>(null);
const editingPlugin = ref<PluginConfig>({
  id: '',
  config: {},
});

const configJSON = ref('{}');

const availableFieldIds = computed(() => {
  return blueprintStore.fields.map(f => f.id);
});

function openPluginDialog(index?: number) {
  if (index !== undefined && index >= 0 && index < blueprintStore.plugins.length) {
    editingIndex.value = index;
    const plugin = blueprintStore.plugins[index]!;
    editingPlugin.value = {
      id: plugin.id,
      instanceId: plugin.instanceId,
      triggerOnField: plugin.triggerOnField,
      config: { ...plugin.config },
    };
    configJSON.value = JSON.stringify(editingPlugin.value.config, null, 2);
  } else {
    editingIndex.value = null;
    editingPlugin.value = {
      id: '',
      config: {},
    };
    configJSON.value = '{}';
  }
  pluginDialog.value = true;
}

function savePlugin() {
  try {
    editingPlugin.value.config = JSON.parse(configJSON.value);
  } catch (e) {
    alert('Invalid JSON in configuration');
    return;
  }

  if (editingIndex.value !== null) {
    blueprintStore.updatePlugin(editingIndex.value, editingPlugin.value);
  } else {
    blueprintStore.addPlugin(editingPlugin.value);
  }
  pluginDialog.value = false;
}

function deletePlugin(index: number) {
  if (confirm('Are you sure you want to delete this plugin?')) {
    blueprintStore.deletePlugin(index);
  }
}
</script>

<style scoped>
.plugin-list-card {
  border-radius: 16px;
  border-color: rgb(var(--v-theme-outline-variant)) !important;
}

.plugin-item {
  border-radius: 12px;
  margin-bottom: 8px;
}
</style>
