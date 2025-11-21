<template>
  <div class="chat-view">
    <!-- Messages Container -->
    <div class="messages-container" ref="messagesContainer">
      <div class="messages-wrapper">
        <div class="messages-content">
          <MessageBubble
            v-for="message in messages"
            :key="message.id"
            :text="message.text"
            :is-user="message.isUser"
            :timestamp="message.timestamp"
          />
        </div>
      </div>
    </div>

    <!-- Chat Input -->
    <ChatInput @send="handleSendMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ChatInput from '@/components/chat/ChatInput.vue'

interface Message {
  id: number
  text: string
  isUser: boolean
  timestamp: Date
}

const messages = ref<Message[]>([
  {
    id: 1,
    text: 'Hello! I\'m your Form Assistant. I can help you fill out forms and answer questions. How can I assist you today?',
    isUser: false,
    timestamp: new Date(Date.now() - 120000) // 2 minutes ago
  },
  {
    id: 2,
    text: 'Hi! I need help filling out a travel authorization form.',
    isUser: true,
    timestamp: new Date(Date.now() - 60000) // 1 minute ago
  }
])

const messagesContainer = ref<HTMLElement | null>(null)
let messageIdCounter = 3

const handleSendMessage = async (text: string) => {
  // Add user message
  messages.value.push({
    id: messageIdCounter++,
    text,
    isUser: true,
    timestamp: new Date()
  })

  // Scroll to bottom
  await nextTick()
  scrollToBottom()

  // Simulate AI response after a short delay
  setTimeout(async () => {
    messages.value.push({
      id: messageIdCounter++,
      text: 'I understand you need help with a travel authorization form. I\'ll guide you through the process. Let\'s start with some basic information.',
      isUser: false,
      timestamp: new Date()
    })

    await nextTick()
    scrollToBottom()
  }, 1000)
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
  overflow: hidden;
  background-color: #131314;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.messages-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  width: 100%;
}

.messages-content {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  padding-top: 32px;
  padding-bottom: 24px;
  min-height: min-content;
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
