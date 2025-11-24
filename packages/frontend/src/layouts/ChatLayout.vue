<template>
  <v-app>
    <!-- Navigation Drawer (History) -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="rail"
      permanent
      @click="rail = false"
    >
      <v-list-item
        prepend-icon="mdi-history"
        title="History"
        nav
      >
        <template v-slot:append>
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            @click.stop="rail = !rail"
          ></v-btn>
        </template>
      </v-list-item>

      <v-divider></v-divider>

      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-chat-plus"
          title="New Chat"
          value="new"
          @click="handleNewChat"
        ></v-list-item>
        
        <v-divider class="my-2"></v-divider>
        
        <v-list-item
          v-for="conversation in chatStore.conversations"
          :key="conversation.id"
          :prepend-icon="conversation.status === 'COMPLETED' ? 'mdi-check-circle' : 'mdi-chat'"
          :title="getConversationTitle(conversation)"
          :subtitle="formatDate(conversation.updatedAt)"
          :value="conversation.id"
          :active="chatStore.conversationId === conversation.id"
          @click="handleLoadConversation(conversation.id)"
        >
          <template v-slot:append>
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="x-small"
              @click.stop="handleDeleteConversation(conversation.id)"
            ></v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar flat>
      <v-app-bar-nav-icon
        variant="text"
        @click.stop="drawer = !drawer"
      ></v-app-bar-nav-icon>

      <v-toolbar-title>Form Assistant</v-toolbar-title>

      <v-spacer></v-spacer>

      <v-btn icon="mdi-dots-vertical" variant="text"></v-btn>
    </v-app-bar>

    <!-- Main Content Area -->
    <v-main>
      <router-view />
    </v-main>

    <!-- Data Inspector FAB -->
    <v-btn
      icon="mdi-database-eye"
      color="primary"
      size="large"
      position="fixed"
      location="bottom end"
      class="ma-4"
      @click="showDataInspector = true"
    >
    </v-btn>

    <!-- Data Inspector Dialog -->
    <v-dialog
      v-model="showDataInspector"
      max-width="800px"
    >
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span class="text-h5">Live Data Inspector</span>
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="showDataInspector = false"
          ></v-btn>
        </v-card-title>
        
        <v-divider></v-divider>
        
        <v-card-text>
          <div class="text-subtitle-2 mb-2">Assembled Form Data:</div>
          <pre class="data-inspector-pre">{{ formattedData }}</pre>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="showDataInspector = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import type { Conversation } from '@/stores/chat'

const drawer = ref(true)
const rail = ref(false)
const showDataInspector = ref(false)

const chatStore = useChatStore()
const router = useRouter()

const formattedData = computed(() => {
  return JSON.stringify(chatStore.currentFormData, null, 2)
})

// Load conversations on mount
onMounted(async () => {
  await chatStore.fetchConversations()
})

function handleNewChat() {
  router.push('/')
}

function handleLoadConversation(id: string) {
  router.push(`/c/${id}`)
}

async function handleDeleteConversation(id: string) {
  if (confirm('Are you sure you want to delete this conversation?')) {
    await chatStore.deleteConversation(id)
  }
}

function getConversationTitle(conversation: Conversation): string {
  // Try to use the blueprintId or first user message as title
  if (conversation.blueprintId) {
    return conversation.blueprintId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
  
  const firstUserMessage = conversation.messages.find(m => m.role === 'user')
  if (firstUserMessage) {
    return firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
  }
  
  return 'New Conversation'
}

function formatDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return d.toLocaleDateString()
}
</script>

<style scoped>
/* Ensure main takes full height and doesn't overflow */
.v-main {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.v-main :deep(.v-main__wrap) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.data-inspector-pre {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: 500px;
  overflow-y: auto;
}
</style>
