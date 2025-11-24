/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          background: '#f8f9fa',
          surface: '#ffffff',
          primary: '#1a73e8',
          secondary: '#5f6368',
          'on-surface': '#202124',
        },
      },
      dark: {
        colors: {
          background: '#131314',
          surface: '#1e1f20',
          primary: '#8ab4f8',
          secondary: '#c9d1d9',
        },
      },
    },
  },
})
