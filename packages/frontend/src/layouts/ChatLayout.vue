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
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const drawer = ref(true)
const rail = ref(false)
</script>

<style scoped>
/* Ensure main takes full height */
.v-main {
  height: 100%;
}
</style>
