import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the frontend talks to the API via the /api proxy below,
// so the client code can always call relative URLs ("/api/...").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
      // Uploaded question media + candidate answer files are served by the API.
      '/uploads': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
