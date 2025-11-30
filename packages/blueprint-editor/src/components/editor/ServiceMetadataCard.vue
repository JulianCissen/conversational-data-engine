<template>
  <v-card :elevation="0" variant="outlined" class="metadata-card">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-information-outline</v-icon>
      Service Metadata
    </v-card-title>

    <v-divider />

    <v-card-text>
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="localId"
            label="Service ID *"
            hint="Unique identifier (e.g., 'travel_expense')"
            persistent-hint
            variant="outlined"
            density="comfortable"
            :rules="[rules.required, rules.idFormat]"
            @blur="updateStore"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="localName"
            label="Service Name *"
            hint="Human-readable name"
            persistent-hint
            variant="outlined"
            density="comfortable"
            :rules="[rules.required]"
            @blur="updateStore"
          />
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <div class="language-config-section">
        <div class="d-flex align-center mb-3">
          <v-icon class="mr-2">mdi-translate</v-icon>
          <span class="text-subtitle-1 font-weight-medium">Language Configuration</span>
        </div>

        <v-checkbox
          v-model="languageConfigEnabled"
          label="Configure explicit language settings"
          hint="When enabled, you can specify how the service handles language detection and defaults"
          persistent-hint
          density="comfortable"
          @update:model-value="toggleLanguageConfig"
        />

        <v-expand-transition>
          <v-row v-if="languageConfigEnabled" class="mt-2">
            <v-col cols="12" md="6">
              <v-select
                v-model="localLanguageMode"
                label="Language Mode"
                :items="['adaptive', 'strict']"
                variant="outlined"
                density="comfortable"
                hint="Adaptive: AI adapts to user's language. Strict: Enforces specific language."
                persistent-hint
                @update:model-value="updateLanguageConfig"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="localDefaultLanguage"
                label="Default Language"
                placeholder="en-US, de-DE, fr-FR"
                variant="outlined"
                density="comfortable"
                hint="ISO-639 language code"
                persistent-hint
                @blur="updateLanguageConfig"
              />
            </v-col>
          </v-row>
        </v-expand-transition>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useBlueprintStore } from '../../stores/blueprint';
import type { LanguageConfig } from '@conversational-data-engine/types';

const blueprintStore = useBlueprintStore();

// Local state
const localId = ref(blueprintStore.id);
const localName = ref(blueprintStore.name);
const localLanguageConfig = ref<LanguageConfig | undefined>(blueprintStore.languageConfig);
const localLanguageMode = ref(blueprintStore.languageConfig?.mode || 'adaptive');
const localDefaultLanguage = ref(blueprintStore.languageConfig?.defaultLanguage || 'en-US');
const languageConfigEnabled = ref(!!blueprintStore.languageConfig);

// Validation rules
const rules = {
  required: (value: string) => !!value || 'Required field',
  idFormat: (value: string) => {
    const pattern = /^[a-z0-9_-]+$/;
    return pattern.test(value) || 'Use only lowercase letters, numbers, underscores, and hyphens';
  },
};

// Watch store changes
watch(() => blueprintStore.id, (newVal) => {
  localId.value = newVal;
});

watch(() => blueprintStore.name, (newVal) => {
  localName.value = newVal;
});

watch(() => blueprintStore.languageConfig, (newVal) => {
  localLanguageConfig.value = newVal;
  if (newVal) {
    localLanguageMode.value = newVal.mode;
    localDefaultLanguage.value = newVal.defaultLanguage;
    languageConfigEnabled.value = true;
  } else {
    languageConfigEnabled.value = false;
  }
}, { deep: true });

function updateStore() {
  blueprintStore.updateMetadata({
    id: localId.value,
    name: localName.value,
  });
}

function updateLanguageConfig() {
  if (localLanguageMode.value && localDefaultLanguage.value) {
    localLanguageConfig.value = {
      mode: localLanguageMode.value as 'adaptive' | 'strict',
      defaultLanguage: localDefaultLanguage.value,
    };
    blueprintStore.updateMetadata({
      languageConfig: localLanguageConfig.value,
    });
  }
}

function toggleLanguageConfig(enabled: boolean | null) {
  if (enabled) {
    updateLanguageConfig();
  } else {
    clearLanguageConfig();
  }
}

function clearLanguageConfig() {
  localLanguageConfig.value = undefined;
  localLanguageMode.value = 'adaptive';
  localDefaultLanguage.value = 'en-US';
  languageConfigEnabled.value = false;
  blueprintStore.updateMetadata({
    languageConfig: undefined,
  });
}
</script>

<style scoped>
.metadata-card {
  border-radius: 16px;
  border-color: rgb(var(--v-theme-outline-variant)) !important;
}

.language-config-section {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
