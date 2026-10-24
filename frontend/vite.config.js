import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to Vite (5173) only. Vite forwards /api and /health to the
// backend, so the page and the API share one origin: no CORS needed, and the
// SameSite=Strict refresh cookie is sent without any special setting.
const BACKEND = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': BACKEND,
      '/health': BACKEND,
    },
  },
});