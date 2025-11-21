<template>
  <div class="message-wrapper" :class="{ 'user-message': isUser, 'ai-message': !isUser }">
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
    
    <!-- AI message without bubble -->
    <div v-else class="ai-message-content">
      <div class="message-text">
        {{ text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  text: string
  isUser: boolean
  timestamp: Date
}

const props = defineProps<Props>()

const formattedTimestamp = computed(() => {
  return props.timestamp.toLocaleTimeString('en-US', {
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

.ai-message {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 70%;
  border-radius: 18px;
  padding: 12px 16px;
}

.user-bubble {
  background-color: #2d3035;
  color: #e3e3e3;
}

.ai-message-content {
  max-width: 70%;
}

.message-text {
  word-wrap: break-word;
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 0.95rem;
}

.ai-message .message-text {
  color: #e3e3e3;
}
</style>
