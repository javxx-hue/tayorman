import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // oflayn-dastur is a separate project with its own node tests
  test: { exclude: [...configDefaults.exclude, 'oflayn-dastur/**'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: they rarely change, so phones keep them cached across our releases
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
