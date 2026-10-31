import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The admin site is a separate app (admin/) built to dist-admin and deployed on its own,
// so none of its code ships inside the student Mini App.
export default defineConfig({
  root: 'admin',
  envDir: '..',
  plugins: [react()],
  css: { postcss: path.resolve(__dirname) },
  build: { outDir: '../dist-admin', emptyOutDir: true },
  server: { port: 5174 },
});
