import { ref, onMounted } from 'vue';
import { useTheme } from 'vuetify';

export type ThemeName = 'light' | 'dark';

/**
 * Composable for managing theme state with localStorage persistence
 */
export function useThemeToggle() {
  const theme = useTheme();
  const currentTheme = ref<ThemeName>('light');

  onMounted(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      theme.global.name.value = savedTheme;
      currentTheme.value = savedTheme;
    }
  });

  function toggleTheme() {
    const newTheme: ThemeName = theme.global.name.value === 'dark' ? 'light' : 'dark';
    theme.global.name.value = newTheme;
    currentTheme.value = newTheme;
    localStorage.setItem('theme', newTheme);
  }

  function setTheme(themeName: ThemeName) {
    theme.global.name.value = themeName;
    currentTheme.value = themeName;
    localStorage.setItem('theme', themeName);
  }

  return {
    currentTheme,
    toggleTheme,
    setTheme,
  };
}
