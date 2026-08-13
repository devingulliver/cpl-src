import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const mainEntry = new URL('./index.html', import.meta.url);
const adminEntry = new URL('./admin.html', import.meta.url);

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: mainEntry.pathname,
        admin: adminEntry.pathname,
      },
    },
  },
});
