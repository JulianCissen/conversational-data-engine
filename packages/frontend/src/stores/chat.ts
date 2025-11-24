import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export interface Message {
  role: 'user' | 'system'
  content: string
  timestamp: Date
}

export interface Conversation {
  id: string
  createdAt: Date
  updatedAt: Date
  data: Record<string, any>
  status: 'COLLECTING' | 'COMPLETED'
  currentFieldId?: string
  blueprintId?: string
  blueprintName?: string
  messages: Message[]
}

export interface ChatResponse {
  conversationId: string
  text: string
  isComplete: boolean
  data: Record<string, any>
}

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<Message[]>([])
  const conversations = ref<Conversation[]>([])
  const conversationId = ref<string | null>(null)
  const isLoading = ref<boolean>(false)
  const currentFormData = ref<Record<string, any>>({})

  // Backend API URL
  const API_URL = 'http://localhost:3001'

  // Actions
  async function sendMessage(text: string) {
    try {
      // Add user message to state
      const userMessage: Message = {
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      messages.value.push(userMessage)

      // Set loading state
      isLoading.value = true

      // Send message to backend
      const response = await axios.post<ChatResponse>(`${API_URL}/conversation`, {
        conversationId: conversationId.value,
        text,
      })

      // If this is a new conversation, fetch the conversation list and update URL
      const isNewConversation = !conversationId.value
      conversationId.value = response.data.conversationId

      if (isNewConversation) {
        // Refresh conversation list
        await fetchConversations()
        // Navigate to the new conversation URL
        window.history.pushState({}, '', `/c/${response.data.conversationId}`)
      }

      // Update current form data
      currentFormData.value = response.data.data || {}

      // Add system response to state
      const systemMessage: Message = {
        role: 'system',
        content: response.data.text,
        timestamp: new Date(),
      }
      messages.value.push(systemMessage)

      // If the conversation is complete, you could trigger an event here
      if (response.data.isComplete) {
        console.log('Conversation completed!')
        // Refresh conversation list to update status
        await fetchConversations()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message to chat
      const errorMessage: Message = {
        role: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
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
    conversationId.value = null
    currentFormData.value = {}
  }

  async function fetchConversations() {
    try {
      const response = await axios.get<Conversation[]>(`${API_URL}/conversation`)
      conversations.value = response.data
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  async function fetchWelcomeMessage(): Promise<string> {
    try {
      const response = await axios.get<{ welcomeMessage: string }>(`${API_URL}/conversation/config`)
      return response.data.welcomeMessage
    } catch (error) {
      console.error('Error fetching welcome message:', error)
      return 'Welcome! How can I assist you today?'
    }
  }

  async function loadConversation(id: string) {
    try {
      isLoading.value = true
      const response = await axios.get<Conversation>(`${API_URL}/conversation/${id}`)
      
      conversationId.value = response.data.id
      messages.value = response.data.messages
      currentFormData.value = response.data.data
    } catch (error) {
      console.error('Error loading conversation:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function deleteConversation(id: string) {
    try {
      await axios.delete(`${API_URL}/conversation/${id}`)
      // Remove from local list
      conversations.value = conversations.value.filter(c => c.id !== id)
      
      // If we're viewing the deleted conversation, clear the chat
      if (conversationId.value === id) {
        clearChat()
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }

  return {
    // State
    messages,
    conversations,
    conversationId,
    isLoading,
    currentFormData,
    
    // Actions
    sendMessage,
    clearChat,
    fetchConversations,
    fetchWelcomeMessage,
    loadConversation,
    deleteConversation,
  }
})
