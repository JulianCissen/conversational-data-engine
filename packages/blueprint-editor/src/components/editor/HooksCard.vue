<template>
  <v-card :elevation="0" variant="outlined" class="hooks-card">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-hook</v-icon>
      Lifecycle Hooks
    </v-card-title>

    <v-divider />

    <v-card-text>
      <div class="hook-section mb-6">
        <div class="text-subtitle-2 mb-2">
          <v-icon size="small" class="mr-1">mdi-play-circle</v-icon>
          On Start
        </div>
        <v-combobox
          v-model="localHooks.onStart"
          label="Plugin Instance IDs"
          hint="Plugins to execute when the service starts"
          persistent-hint
          :items="availablePluginInstances"
          variant="outlined"
          density="comfortable"
          chips
          multiple
          clearable
          @update:model-value="updateHooks"
        />
      </div>

      <div class="hook-section mb-6">
        <div class="text-subtitle-2 mb-2">
          <v-icon size="small" class="mr-1">mdi-check-circle</v-icon>
          On Field Validated
        </div>
        <v-combobox
          v-model="localHooks.onFieldValidated"
          label="Plugin Instance IDs"
          hint="Plugins to execute after a field is validated"
          persistent-hint
          :items="availablePluginInstances"
          variant="outlined"
          density="comfortable"
          chips
          multiple
          clearable
          @update:model-value="updateHooks"
        />
      </div>

      <div class="hook-section">
        <div class="text-subtitle-2 mb-2">
          <v-icon size="small" class="mr-1">mdi-flag-checkered</v-icon>
          On Conversation Complete
        </div>
        <v-combobox
          v-model="localHooks.onConversationComplete"
          label="Plugin Instance IDs"
          hint="Plugins to execute when the conversation is complete"
          persistent-hint
          :items="availablePluginInstances"
          variant="outlined"
          density="comfortable"
          chips
          multiple
          clearable
          @update:model-value="updateHooks"
        />
      </div>

      <v-alert v-if="hasInvalidReferences" type="warning" variant="tonal" class="mt-4">
        Some hook references point to plugin instances that don't exist in the plugins list.
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useBlueprintStore } from '../../stores/blueprint';
import type { ServiceHooks } from '@conversational-data-engine/types';

const blueprintStore = useBlueprintStore();

const localHooks = ref<ServiceHooks>({
  onStart: blueprintStore.hooks.onStart || [],
  onFieldValidated: blueprintStore.hooks.onFieldValidated || [],
  onConversationComplete: blueprintStore.hooks.onConversationComplete || [],
});

// Get available plugin instance IDs
const availablePluginInstances = computed(() => {
  return blueprintStore.plugins.map(p => p.instanceId || p.id);
});

// Check if any hooks reference non-existent plugins
const hasInvalidReferences = computed(() => {
  const allHooks = [
    ...(localHooks.value.onStart || []),
    ...(localHooks.value.onFieldValidated || []),
    ...(localHooks.value.onConversationComplete || []),
  ];
  return allHooks.some(hookId => !availablePluginInstances.value.includes(hookId));
});

// Watch store hooks for external changes
watch(() => blueprintStore.hooks, (newHooks) => {
  localHooks.value = {
    onStart: newHooks.onStart || [],
    onFieldValidated: newHooks.onFieldValidated || [],
    onConversationComplete: newHooks.onConversationComplete || [],
  };
}, { deep: true });

function updateHooks() {
  blueprintStore.updateHooks(localHooks.value);
}
</script>

<style scoped>
.hooks-card {
  border-radius: 16px;
  border-color: rgb(var(--v-theme-outline-variant)) !important;
}

.hook-section {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
