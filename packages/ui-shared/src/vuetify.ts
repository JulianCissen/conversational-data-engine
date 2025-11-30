/**
 * Shared Vuetify configuration for Conversational Data Engine applications
 * Provides consistent Material Design 3 theming across all frontends
 */

import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export default createVuetify({
  defaults: {
    VBtn: {
      rounded: 'pill',
      elevation: 0,
      style: 'text-transform: none; letter-spacing: normal;',
    },
    VCard: {
      rounded: 'xl',     // M3: 16px for cards
      elevation: 0,      // M3: Use tonal surface colors instead of elevation
    },
    VCardTitle: {
      style: 'padding: 24px 24px 16px;',  // M3: Increased top/side padding for dialog titles
    },
    VCardText: {
      style: 'padding: 16px 24px 24px;',  // M3: Consistent padding with title, add top margin
    },
    VDialog: {
      contentClass: 'rounded-xxl',  // M3: 28px for dialogs
    },
    VExpansionPanels: {
      elevation: 0,
      variant: 'accordion',
      flat: true,
      bgColor: 'transparent',
      color: 'outline-variant',
      style: 'border: 1px solid rgb(var(--v-theme-outline-variant)); border-radius: 12px;',
    },
    VExpansionPanel: {
      elevation: 0,
      bgColor: 'surface',
      style: 'border-bottom: 1px solid rgb(var(--v-theme-outline-variant));',
    },
    VExpansionPanelTitle: {
      style: 'padding: 16px 24px;',  // M3: Standard padding for panel headers
    },
    VExpansionPanelText: {
      style: 'padding-top: 16px;',  // Add top margin to panel content
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',  // M3: Comfortable density by default
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VChip: {
      rounded: 'lg',     // M3: 8px for chips
      elevation: 0,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          background: '#fafafa',           // M3 neutral light background
          surface: '#ffffff',
          'surface-bright': '#ffffff',
          'surface-container': '#f5f5f5',
          'surface-container-low': '#f9f9f9',
          'surface-container-high': '#eeeeee',
          'surface-container-highest': '#e8e8e8',
          'surface-variant': '#e0e0e0',
          'on-surface-variant': '#5f5f5f',
          primary: '#1a73e8',              // Google Blue
          secondary: '#5f6368',            // Gray
          'on-surface': '#1c1c1c',         // M3 on-surface
          outline: '#757575',              // M3 outline
          'outline-variant': '#c4c4c4',    // M3 outline-variant
        },
      },
      dark: {
        colors: {
          background: '#121212',
          surface: '#1e1e1e',
          'surface-bright': '#3a3a3a',
          'surface-container': '#252525',
          'surface-container-low': '#1e1e1e',
          'surface-container-high': '#2c2c2c',
          'surface-container-highest': '#353535',
          'surface-variant': '#4a4a4a',
          'on-surface-variant': '#c4c4c4',
          primary: '#8ab4f8',              // Light Blue
          secondary: '#c9d1d9',            // Light Gray
          'on-surface': '#e5e5e5',         // M3 on-surface
          outline: '#8e8e8e',              // M3 outline
          'outline-variant': '#3f3f3f',    // M3 outline-variant
        },
      },
    },
  },
});
