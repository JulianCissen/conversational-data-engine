<template>
  <v-app>
    <v-app-bar flat :elevation="0" border>
      <v-app-bar-title>Blueprint Editor</v-app-bar-title>
      
      <v-spacer />
      
      <v-menu>
        <template #activator="{ props }">
          <v-btn icon v-bind="props">
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item @click="toggleTheme">
            <v-list-item-title>
              {{ currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode' }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useThemeToggle } from '@conversational-data-engine/ui-shared';

const { currentTheme, toggleTheme } = useThemeToggle();
</script>
