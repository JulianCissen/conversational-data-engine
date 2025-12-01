<template>
  <div class="message-wrapper" :class="{ 'user-message': isUser, 'system-message': !isUser }">
    <!-- User message with bubble -->
    <v-card
      v-if="isUser"
      class="message-bubble user-bubble"
      elevation="0"
    >
      <v-card-text class="message-text">
        {{ text }}
      </v-card-text>
    </v-card>
    
    <!-- System message without bubble, with markdown rendering -->
    <div v-else class="system-message-content">
      <div class="message-text">
        <MarkdownText :text="text" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownText from '../common/MarkdownText.vue'

interface Props {
  text: string
  isUser: boolean
  timestamp: Date | string
}

const props = defineProps<Props>()

const formattedTimestamp = computed(() => {
  const date = typeof props.timestamp === 'string' ? new Date(props.timestamp) : props.timestamp
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
})
</script>

<style scoped>
.message-wrapper {
  display: flex;
  margin-bottom: 24px;
  padding: 0 16px;
}

.user-message {
  justify-content: flex-end;
}

.system-message {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 70%;
  border-radius: 18px;
  padding: 12px 16px;
}

.user-bubble {
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.system-message-content {
  max-width: 70%;
}

.message-text {
  word-wrap: break-word;
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 0.95rem;
}
</style>
