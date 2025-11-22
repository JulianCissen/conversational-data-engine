<template>
  <div class="chat-view">
    <!-- Messages Container -->
    <div class="messages-container" ref="messagesContainer">
      <div class="messages-content">
        <MessageBubble
          v-for="message in chatStore.messages"
          :key="message.id"
          :text="message.text"
          :is-user="message.isUser"
          :timestamp="message.timestamp"
        />
        
        <!-- Loading indicator -->
        <div v-if="chatStore.isLoading" class="loading-container">
          <v-progress-circular
            indeterminate
            color="primary"
            size="32"
          />
        </div>
      </div>
    </div>

    <!-- Chat Input -->
    <div class="chat-input-wrapper">
      <ChatInput @send="handleSendMessage" :disabled="chatStore.isLoading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)

const handleSendMessage = async (text: string) => {
  await chatStore.sendMessage(text)
  
  // Scroll to bottom after message is added
  await nextTick()
  scrollToBottom()
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Watch for new messages and scroll to bottom
watch(() => chatStore.messages.length, async () => {
  await nextTick()
  scrollToBottom()
})

// Initialize with first message when component mounts
onMounted(async () => {
  if (chatStore.messages.length === 0) {
    // Start a new conversation
    await chatStore.sendMessage('Hello')
  }
  scrollToBottom()
})
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: #131314;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0; /* Important: allows flex child to shrink below content size */
  display: flex;
  justify-content: center;
}

.messages-content {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  padding: 32px 16px 24px;
}

.chat-input-wrapper {
  flex-shrink: 0;
  background-color: #131314;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

/* Scrollbar styling */
.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
