<template>
  <v-card :elevation="0" variant="outlined" class="field-list-card">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <v-icon class="mr-2">mdi-form-textbox</v-icon>
        Fields
        <v-chip size="small" class="ml-2">{{ blueprintStore.fields.length }}</v-chip>
      </div>
      <v-btn
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openFieldDialog()"
      >
        Add field
      </v-btn>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <v-list v-if="blueprintStore.fields.length > 0">
        <v-list-item
          v-for="(field, index) in blueprintStore.fields"
          :key="field.id"
          class="field-item"
        >
          <template #prepend>
            <v-icon>mdi-drag-vertical</v-icon>
          </template>

          <v-list-item-title>
            <strong>{{ field.id }}</strong>
            <v-chip size="x-small" class="ml-2" :color="getTypeColor(field.type)">
              {{ field.type }}
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle>{{ field.questionTemplate }}</v-list-item-subtitle>

          <template #append>
            <v-btn icon="mdi-content-copy" size="small" variant="text" @click="duplicateField(index)" />
            <v-btn icon="mdi-pencil" size="small" variant="text" @click="openFieldDialog(index)" />
            <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="deleteField(index)" />
          </template>
        </v-list-item>
      </v-list>

      <v-alert v-else type="info" variant="tonal">
        No fields configured. Click "Add Field" to create your first field.
      </v-alert>
    </v-card-text>

    <!-- Field Editor Dialog -->
    <v-dialog v-model="fieldDialog" max-width="900" scrollable>
      <v-card>
        <v-card-title>{{ editingIndex === null ? 'Add' : 'Edit' }} Field</v-card-title>
        <v-divider />
        <v-card-text>
          <v-form ref="fieldForm">
            <v-text-field
              v-model="editingField.id"
              label="Field ID *"
              hint="Unique identifier (e.g., 'user_age')"
              persistent-hint
              variant="outlined"
              density="comfortable"
              class="mb-4"
            />

            <v-select
              v-model="editingField.type"
              label="Type *"
              :items="['string', 'number', 'boolean', 'date']"
              variant="outlined"
              density="comfortable"
              class="mb-4"
            />

            <v-textarea
              v-model="editingField.questionTemplate"
              label="Question Template *"
              hint="The question the AI will ask"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rows="2"
              class="mb-4"
            />

            <v-textarea
              v-model="editingField.aiContext"
              label="AI Context *"
              hint="Explain to the AI why this field is needed"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rows="3"
              class="mb-4"
            />

            <v-expansion-panels class="mb-4">
              <v-expansion-panel>
                <v-expansion-panel-title>Validation Rules (JSON Schema)</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-textarea
                    v-model="validationJSON"
                    label="Validation (JSON)"
                    hint="JSON Schema validation rules"
                    persistent-hint
                    variant="outlined"
                    rows="5"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel>
                <v-expansion-panel-title>Advanced Options</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-switch
                    v-model="editingField.verbatim"
                    label="Verbatim Question"
                    hint="Question must be asked exactly as written"
                    persistent-hint
                    color="primary"
                    class="mb-4"
                  />

                  <v-textarea
                    v-model="conditionJSON"
                    label="Condition (JsonLogic)"
                    hint="Optional JsonLogic condition for conditional display"
                    persistent-hint
                    variant="outlined"
                    rows="3"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="fieldDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" @click="saveField">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBlueprintStore } from '../../stores/blueprint';
import type { FieldDefinition } from '@conversational-data-engine/types';

const blueprintStore = useBlueprintStore();

const fieldDialog = ref(false);
const editingIndex = ref<number | null>(null);
const editingField = ref<FieldDefinition>({
  id: '',
  type: 'string',
  questionTemplate: '',
  aiContext: '',
  validation: {},
});

const validationJSON = ref('{}');
const conditionJSON = ref('');

function openFieldDialog(index?: number) {
  if (index !== undefined && index >= 0 && index < blueprintStore.fields.length) {
    editingIndex.value = index;
    const field = blueprintStore.fields[index]!;
    editingField.value = {
      id: field.id,
      type: field.type,
      questionTemplate: field.questionTemplate,
      aiContext: field.aiContext,
      validation: { ...field.validation },
      condition: field.condition,
      verbatim: field.verbatim,
    };
    validationJSON.value = JSON.stringify(editingField.value.validation, null, 2);
    conditionJSON.value = editingField.value.condition ? JSON.stringify(editingField.value.condition, null, 2) : '';
  } else {
    editingIndex.value = null;
    editingField.value = {
      id: '',
      type: 'string',
      questionTemplate: '',
      aiContext: '',
      validation: {},
    };
    validationJSON.value = '{}';
    conditionJSON.value = '';
  }
  fieldDialog.value = true;
}

function saveField() {
  try {
    editingField.value.validation = JSON.parse(validationJSON.value);
    if (conditionJSON.value.trim()) {
      editingField.value.condition = JSON.parse(conditionJSON.value);
    }
  } catch (e) {
    alert('Invalid JSON in validation or condition');
    return;
  }

  if (editingIndex.value !== null) {
    blueprintStore.updateField(editingIndex.value, editingField.value);
  } else {
    blueprintStore.addField(editingField.value);
  }
  fieldDialog.value = false;
}

function duplicateField(index: number) {
  blueprintStore.duplicateField(index);
}

function deleteField(index: number) {
  if (confirm('Are you sure you want to delete this field?')) {
    blueprintStore.deleteField(index);
  }
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    string: 'blue',
    number: 'green',
    boolean: 'orange',
    date: 'purple',
  };
  return colors[type] || 'grey';
}
</script>

<style scoped>
.field-list-card {
  border-radius: 16px;
  border-color: rgb(var(--v-theme-outline-variant)) !important;
}

.field-item {
  border-radius: 12px;
  margin-bottom: 8px;
}
</style>
