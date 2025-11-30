<template>
  <v-container fluid class="editor-container">
    <v-row>
      <!-- Left Panel: Form Editor -->
      <v-col cols="12" md="8" class="editor-panel">
        <!-- Service Metadata Section -->
        <service-metadata-card class="mb-6" />
        
        <!-- Fields Section -->
        <field-list-card class="mb-6" />
        
        <!-- Plugins Section -->
        <plugin-list-card class="mb-6" />
        
        <!-- Hooks Section -->
        <hooks-card class="mb-6" />
      </v-col>

      <!-- Right Panel: JSON Preview -->
      <v-col cols="12" md="4" class="preview-panel">
        <json-preview-card />
      </v-col>
    </v-row>

    <!-- Bottom Action Bar -->
    <div class="action-bar">
      <v-container>
        <v-row align="center" justify="space-between">
          <v-col cols="auto">
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-file-document-outline"
                  v-bind="props"
                >
                  Templates
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="loadTemplate('empty')">
                  <v-list-item-title>Empty Blueprint</v-list-item-title>
                </v-list-item>
                <v-list-item @click="loadTemplate('travel-expense')">
                  <v-list-item-title>Travel Expense (Example)</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <v-btn
              variant="outlined"
              prepend-icon="mdi-upload"
              class="ml-2"
              @click="handleImport"
            >
              Import JSON
            </v-btn>
          </v-col>

          <v-col cols="auto">
            <v-btn
              variant="outlined"
              color="error"
              prepend-icon="mdi-delete"
              @click="confirmClearAll"
            >
              Clear all
            </v-btn>

            <v-btn
              variant="tonal"
              color="primary"
              prepend-icon="mdi-download"
              class="ml-2"
              :disabled="!blueprintStore.isValid"
              @click="handleExport"
            >
              Export JSON
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- Import Dialog -->
    <v-dialog v-model="importDialog" max-width="600">
      <v-card>
        <v-card-title>Import Blueprint JSON</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="importJSON"
            label="Paste JSON here"
            rows="15"
            variant="outlined"
            :error-messages="importError"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="importDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" @click="confirmImport">Import</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Clear Confirmation Dialog -->
    <v-dialog v-model="clearDialog" max-width="400">
      <v-card>
        <v-card-title>Clear All Data?</v-card-title>
        <v-card-text>
          This will remove all fields, plugins, and settings. This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="clearDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="error" @click="confirmClear">Clear all</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Hidden file input for import -->
    <input
      ref="fileInput"
      type="file"
      accept="application/json"
      style="display: none"
      @change="handleFileSelect"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useBlueprintStore } from '../stores/blueprint';
import ServiceMetadataCard from '../components/editor/ServiceMetadataCard.vue';
import FieldListCard from '../components/editor/FieldListCard.vue';
import PluginListCard from '../components/editor/PluginListCard.vue';
import HooksCard from '../components/editor/HooksCard.vue';
import JsonPreviewCard from '../components/editor/JsonPreviewCard.vue';

const blueprintStore = useBlueprintStore();

// Import functionality
const importDialog = ref(false);
const importJSON = ref('');
const importError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

function handleImport() {
  importJSON.value = '';
  importError.value = '';
  importDialog.value = true;
}

function confirmImport() {
  const result = blueprintStore.importBlueprint(importJSON.value);
  if (result.success) {
    importDialog.value = false;
    importJSON.value = '';
    importError.value = '';
  } else {
    importError.value = result.error || 'Import failed';
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      importJSON.value = e.target?.result as string;
      importDialog.value = true;
    };
    reader.readAsText(file);
  }
}

// Export functionality
function handleExport() {
  const blob = blueprintStore.exportBlueprint();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${blueprintStore.id || 'blueprint'}.blueprint.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Clear functionality
const clearDialog = ref(false);

function confirmClearAll() {
  clearDialog.value = true;
}

function confirmClear() {
  blueprintStore.clearAll();
  clearDialog.value = false;
}

// Template loading
function loadTemplate(templateName: string) {
  blueprintStore.loadTemplate(templateName);
}
</script>

<style scoped>
.editor-container {
  padding: 24px;
  padding-bottom: 100px;
}

.editor-panel {
  padding-right: 12px;
}

.preview-panel {
  padding-left: 12px;
  border-left: 1px solid rgb(var(--v-theme-outline-variant));
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
  backdrop-filter: blur(8px);
  background-color: rgb(var(--v-theme-surface-container-low));
  padding: 16px 0;
  z-index: 10;
}
</style>
