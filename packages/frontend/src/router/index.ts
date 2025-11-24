/**
 * router/index.ts
 *
 * Application routing configuration
 */

import { createRouter, createWebHistory } from 'vue-router'
import ChatLayout from '@/layouts/ChatLayout.vue'
import ChatView from '@/views/ChatView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: ChatLayout,
      children: [
        {
          path: '',
          name: 'chat',
          component: ChatView
        },
        {
          path: 'c/:id',
          name: 'conversation',
          component: ChatView
        }
      ]
    }
  ]
})

export default router
