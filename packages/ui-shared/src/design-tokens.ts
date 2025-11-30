/**
 * Design system constants for consistent styling across all UI components
 * Following Material Design 3 principles
 */

export const DESIGN_TOKENS = {
  borderRadius: {
    card: '16px',      // M3 standard for large components
    dialog: '28px',    // M3 extra-large for dialogs
    button: '20px',    // M3 standard for buttons (full rounding)
    small: '8px',      // M3 standard for small components
  },
  spacing: {
    xs: '8px',
    sm: '16px',
    md: '24px',
    lg: '32px',
    xl: '48px',
  },
  maxWidth: {
    content: '900px',
    editor: '1200px',
    wide: '1400px',
  },
  elevation: {
    none: 0,           // M3: Prefer tonal surfaces over elevation
  },
} as const;

/**
 * Returns border style using M3 outline tokens
 * M3: Use outline or outline-variant for borders
 */
export function getBorderStyle(variant: 'outline' | 'outline-variant' = 'outline-variant'): string {
  return `1px solid rgb(var(--v-theme-${variant}))`;
}
