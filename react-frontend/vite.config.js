import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from any sub-path
  // (GitHub Pages project sites, Netlify, Cloudflare Pages, ...).
  base: './',
  server: { port: 3000 },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
