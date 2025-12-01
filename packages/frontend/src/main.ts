/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import 'unfonts.css'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')
