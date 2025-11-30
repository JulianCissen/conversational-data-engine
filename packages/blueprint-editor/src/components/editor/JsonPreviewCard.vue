<template>
  <v-card class="preview-card" :elevation="0" variant="outlined">
    <v-card-title class="d-flex align-center justify-space-between preview-title">
        <span>JSON Preview</span>
        <div>
          <v-chip
            :color="blueprintStore.isValid ? 'success' : 'error'"
            size="small"
            class="mr-2"
          >
            {{ blueprintStore.isValid ? 'Valid' : 'Invalid' }}
          </v-chip>
          <v-btn
            icon="mdi-content-copy"
            variant="text"
            size="small"
            @click="copyToClipboard"
            :disabled="!blueprintStore.isValid"
          />
        </div>
      </v-card-title>

      <v-divider />

      <v-card-text>
        <v-textarea
          :model-value="blueprintStore.blueprintJSONString"
          readonly
          variant="outlined"
          density="compact"
          rows="30"
          class="json-textarea"
        />

        <v-alert
          v-if="!blueprintStore.isValid && blueprintStore.validationErrors"
          type="error"
          class="mt-4"
          density="compact"
        >
          <div class="text-subtitle-2 mb-2">Validation Errors:</div>
          <ul class="error-list">
            <li v-for="(error, index) in blueprintStore.validationErrors.errors" :key="index">
              <strong>{{ error.path.join('.') || 'root' }}:</strong> {{ error.message }}
            </li>
          </ul>
        </v-alert>
      </v-card-text>
    </v-card>

    <v-snackbar v-model="snackbar" timeout="2000" color="success">
      Copied to clipboard!
    </v-snackbar>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useBlueprintStore } from '../../stores/blueprint';

const blueprintStore = useBlueprintStore();
const snackbar = ref(false);

function copyToClipboard() {
  navigator.clipboard.writeText(blueprintStore.blueprintJSONString);
  snackbar.value = true;
}
</script>

<style scoped>
.preview-card {
  border-radius: 16px;
  border-color: rgb(var(--v-theme-outline-variant)) !important;
  background-color: rgb(var(--v-theme-surface));
}

.preview-title {
  background-color: transparent;
}

.preview-card :deep(.v-card-text) {
  background-color: transparent;
}

.json-textarea :deep(textarea) {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  background-color: transparent;
}

.error-list {
  margin-left: 20px;
  font-size: 0.875rem;
}

.error-list li {
  margin-bottom: 8px;
}
</style>
