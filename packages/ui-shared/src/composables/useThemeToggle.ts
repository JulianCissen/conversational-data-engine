import { computed, onMounted } from 'vue';
import { useTheme } from 'vuetify';

export type ThemeName = 'light' | 'dark';

/**
 * Composable for managing theme state with localStorage persistence
 * Uses Vuetify 3's modern theme API
 */
export function useThemeToggle() {
  const theme = useTheme();
  
  // Current theme name - computed from Vuetify's internal state
  const currentTheme = computed(() => theme.name.value as ThemeName);

  // Load saved theme preference on mount
  onMounted(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme.change(savedTheme);
    }
  });

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    theme.toggle();
    const newTheme: ThemeName = theme.current.value.dark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
  }

  return {
    currentTheme,
    toggleTheme,
  };
}
