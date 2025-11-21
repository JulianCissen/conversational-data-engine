import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export interface Message {
  id: number
  text: string
  isUser: boolean
  timestamp: Date
}

export interface ChatResponse {
  sessionId: string
  text: string
  isComplete: boolean
  data: Record<string, any>
}

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<Message[]>([])
  const sessionId = ref<string | null>(null)
  const isLoading = ref<boolean>(false)
  const currentFormData = ref<Record<string, any>>({})
  
  let messageIdCounter = 1

  // Backend API URL
  const API_URL = 'http://localhost:3001'

  // Actions
  async function sendMessage(text: string) {
    try {
      // Add user message to state
      const userMessage: Message = {
        id: messageIdCounter++,
        text,
        isUser: true,
        timestamp: new Date(),
      }
      messages.value.push(userMessage)

      // Set loading state
      isLoading.value = true

      // Send message to backend
      const response = await axios.post<ChatResponse>(`${API_URL}/chat`, {
        sessionId: sessionId.value,
        text,
      })

      // Update sessionId from response
      sessionId.value = response.data.sessionId

      // Update current form data
      currentFormData.value = response.data.data || {}

      // Add AI response to state
      const aiMessage: Message = {
        id: messageIdCounter++,
        text: response.data.text,
        isUser: false,
        timestamp: new Date(),
      }
      messages.value.push(aiMessage)

      // If the conversation is complete, you could trigger an event here
      if (response.data.isComplete) {
        console.log('Conversation completed!')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message to chat
      const errorMessage: Message = {
        id: messageIdCounter++,
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      }
      messages.value.push(errorMessage)
    } finally {
      // Clear loading state
      isLoading.value = false
    }
  }

  function clearChat() {
    messages.value = []
    sessionId.value = null
    currentFormData.value = {}
    messageIdCounter = 1
  }

  return {
    // State
    messages,
    sessionId,
    isLoading,
    currentFormData,
    
    // Actions
    sendMessage,
    clearChat,
  }
})
