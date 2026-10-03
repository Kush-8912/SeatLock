import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// In development, proxy API and WebSocket traffic to the Express server so the
// browser sees a single origin, exactly like production (where Express serves
// the built client). Same-origin means the httpOnly auth cookie just works.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
