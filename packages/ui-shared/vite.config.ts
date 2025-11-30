import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: './src/index.ts',
        vuetify: './src/vuetify.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'vuetify'],
      output: {
        preserveModules: false,
      },
    },
  },
});
