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
          prepend-icon="mdi-chat"
          title="New Conversation"
          value="new"
        ></v-list-item>
        <v-list-item
          prepend-icon="mdi-clock-outline"
          title="Previous Chat 1"
          value="chat1"
        ></v-list-item>
        <v-list-item
          prepend-icon="mdi-clock-outline"
          title="Previous Chat 2"
          value="chat2"
        ></v-list-item>
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
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'

const drawer = ref(true)
const rail = ref(false)
const showDataInspector = ref(false)

const chatStore = useChatStore()

const formattedData = computed(() => {
  return JSON.stringify(chatStore.currentFormData, null, 2)
})
</script>

<style scoped>
/* Ensure main takes full height */
.v-main {
  height: 100%;
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
