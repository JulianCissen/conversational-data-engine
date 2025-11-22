<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <v-card class="input-card" elevation="0">
        <div class="input-content">
          <v-textarea
            v-model="message"
            placeholder="Enter a prompt here"
            rows="1"
            auto-grow
            variant="plain"
            density="comfortable"
            hide-details
            :disabled="disabled"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact="handleNewLine"
            class="message-input"
          ></v-textarea>
          <v-btn
            icon="mdi-send"
            :disabled="!message.trim() || disabled"
            @click="handleSend"
            size="default"
            variant="text"
            class="send-btn"
          ></v-btn>
        </div>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')

const emit = defineEmits<{
  send: [text: string]
}>()

// Props
defineProps<{
  disabled?: boolean
}>()

const handleSend = () => {
  const trimmedMessage = message.value.trim()
  if (trimmedMessage) {
    emit('send', trimmedMessage)
    message.value = ''
  }
}

const handleNewLine = (event: KeyboardEvent) => {
  // Allow default behavior for Shift+Enter (new line)
  // This is just for clarity; the prevent on Enter handles it
}
</script>

<style scoped>
.chat-input-container {
  padding: 24px 16px 32px;
  display: flex;
  justify-content: center;
}

.input-wrapper {
  width: 100%;
  max-width: 900px;
}

.input-card {
  background-color: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.input-card:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
}

.input-content {
  display: flex;
  align-items: flex-end;
  padding: 8px 8px 8px 20px;
  gap: 8px;
}

.message-input {
  flex: 1;
}

:deep(.v-field__input) {
  padding: 12px 0;
  min-height: 24px;
}

:deep(.v-input__control) {
  min-height: auto;
}

.send-btn {
  flex-shrink: 0;
  margin-bottom: 4px;
}
</style>
